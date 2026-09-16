import {requireAsset} from './binary';
import type {SceneRegion} from './sceneRegion';
/** Prefetch after 30% of the loaded radius; pause at 85% if still pending.
 * Early prefetch hides worker latency (CStreaming-style lookahead); late pause
 * avoids freezing the player on every boundary. Caller validates retained state. */
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
  request(position:{x:number;z:number},eligible:boolean,velocity?:{x:number;z:number}){
   if(!this.enabled||this.pending||!eligible)return;
   requireAsset([position.x,position.z].every(Number.isFinite)&&Math.abs(position.x)<=1e7&&Math.abs(position.z)<=1e7,'Invalid following position.');
   // CStreaming-style directional lookahead: center the next window ahead of
   // motion so driving reaches loaded terrain instead of the pause boundary.
   // The 2 s lead covers worker decode; the half-radius clamp keeps the player
   // inside the requested window. Safety (needsPause) still tracks the player.
   let cx=position.x,cy=-position.z;
   if(velocity!==undefined){
    requireAsset([velocity.x,velocity.z].every(v=>Number.isFinite(v)&&Math.abs(v)<=1e4),'Invalid following velocity.');
    const speed=Math.hypot(velocity.x,velocity.z);
    if(speed>0.5){
     const radius=this.requestedRadius??this.region.radius;
     const shift=Math.min(speed*2,radius*0.5);
     cx+=velocity.x/speed*shift;cy+=-velocity.z/speed*shift;
    }
   }
   if(this.requestedRadius===this.region.radius&&this.requestedLodRadius===this.region.lodRadius&&Math.hypot(cx-this.region.x,cy-this.region.y)<this.region.radius*.3)return;
   const next={...this.region,x:cx,y:cy,radius:this.requestedRadius??this.region.radius};
  if(this.requestedLodRadius===undefined)delete next.lodRadius;else next.lodRadius=this.requestedLodRadius;
  this.pending={id:++this.requests,region:next};
  return {id:this.pending.id,region:{...this.pending.region}};
 }
 matches(id:number){return this.enabled&&this.pending?.id===id;}
 needsPause(position:{x:number;z:number}){
  return this.enabled&&!!this.pending&&Math.hypot(position.x-this.region.x,-position.z-this.region.y)>=this.region.radius*.85;
 }
 finish(id:number,success:boolean){
  if(!this.matches(id))return false;
  if(success)this.region=this.pending!.region;else this.enabled=false;
  this.pending=undefined;return true;
 }
 stop(){this.enabled=false;this.pending=undefined;}
 snapshot(){return {enabled:this.enabled,requests:this.requests,pending:this.pending?.id??null,region:{...this.region}};}
}
