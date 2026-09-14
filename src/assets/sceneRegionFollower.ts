import {requireAsset} from './binary';
import type {SceneRegion} from './sceneRegion';
/** Prefetch after 40% of the loaded radius; pause at 75% if still pending.
 * The caller validates retained pedestrian/vehicle state before committing. */
export class SceneRegionFollower {
 private region:SceneRegion;
 private pending:{id:number;region:SceneRegion}|undefined;
 private enabled=true;
 private requests=0;
 private requestedRadius?:number;
 private requestedLodRadius?:number;
 setRadius(radius:number,lodRadius?:number){requireAsset(Number.isFinite(radius)&&radius>=32&&radius<=1000,'Invalid following radius.');requireAsset(lodRadius===undefined||Number.isFinite(lodRadius)&&lodRadius>=radius&&lodRadius<=3000,'Invalid distant following radius.');this.requestedRadius=radius;this.requestedLodRadius=lodRadius;}
 constructor(region:SceneRegion){
  requireAsset(region&&[region.x,region.y,region.radius].every(Number.isFinite)&&Math.abs(region.x)<=1e7&&Math.abs(region.y)<=1e7&&region.radius>=32&&region.radius<=1000,'Following terrain requires a 32–1000 unit region.');
  this.setRadius(region.radius,region.lodRadius);
  this.region={x:region.x,y:region.y,radius:region.radius,includeCollisionBounds:true,...(region.lodRadius===undefined?{}:{lodRadius:region.lodRadius})};
 }
 request(position:{x:number;z:number},eligible:boolean){
  if(!this.enabled||this.pending||!eligible)return;
  requireAsset([position.x,position.z].every(Number.isFinite)&&Math.abs(position.x)<=1e7&&Math.abs(position.z)<=1e7,'Invalid following position.');
  if(this.requestedRadius===this.region.radius&&this.requestedLodRadius===this.region.lodRadius&&Math.hypot(position.x-this.region.x,-position.z-this.region.y)<this.region.radius*.4)return;
  const next={...this.region,x:position.x,y:-position.z,radius:this.requestedRadius??this.region.radius};
  if(this.requestedLodRadius===undefined)delete next.lodRadius;else next.lodRadius=this.requestedLodRadius;
  this.pending={id:++this.requests,region:next};
  return {id:this.pending.id,region:{...this.pending.region}};
 }
 matches(id:number){return this.enabled&&this.pending?.id===id;}
 needsPause(position:{x:number;z:number}){
  return this.enabled&&!!this.pending&&Math.hypot(position.x-this.region.x,-position.z-this.region.y)>=this.region.radius*.75;
 }
 finish(id:number,success:boolean){
  if(!this.matches(id))return false;
  if(success)this.region=this.pending!.region;else this.enabled=false;
  this.pending=undefined;return true;
 }
 stop(){this.enabled=false;this.pending=undefined;}
 snapshot(){return {enabled:this.enabled,requests:this.requests,pending:this.pending?.id??null,region:{...this.region}};}
}
