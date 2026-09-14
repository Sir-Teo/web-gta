import {requireAsset} from './binary';
import type {SceneRegion} from './sceneRegion';
/** Prefetch after 40% of the loaded radius; pause at 75% if still pending.
 * The caller commits only from a supported on-foot state. */
export class SceneRegionFollower {
 private region:SceneRegion;
 private pending:{id:number;region:SceneRegion}|undefined;
 private enabled=true;
 private requests=0;
 constructor(region:SceneRegion){
  requireAsset(region&&[region.x,region.y,region.radius].every(Number.isFinite)&&Math.abs(region.x)<=1e7&&Math.abs(region.y)<=1e7&&region.radius>=32&&region.radius<=1000,'Following terrain requires a 32–1000 unit region.');
  this.region={x:region.x,y:region.y,radius:region.radius,includeCollisionBounds:true};
 }
 request(position:{x:number;z:number},eligible:boolean){
  if(!this.enabled||this.pending||!eligible)return;
  requireAsset([position.x,position.z].every(Number.isFinite)&&Math.abs(position.x)<=1e7&&Math.abs(position.z)<=1e7,'Invalid following position.');
  if(Math.hypot(position.x-this.region.x,-position.z-this.region.y)<this.region.radius*.4)return;
  this.pending={id:++this.requests,region:{...this.region,x:position.x,y:-position.z}};
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
