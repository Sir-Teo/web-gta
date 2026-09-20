import {requireAsset} from './binary';
import type {SceneRegion} from './sceneRegion';
/** Prefetch after 30% of the loaded radius; pause at 85% if still pending.
 * Early prefetch hides worker latency (CStreaming-style lookahead); late pause
 * avoids freezing the player on every boundary. Long-distance aerial LODs use
 * the distant radius (reviewed for draw-call and decode budgets). Caller validates retained state. */
/** Fractions of the loaded radius at which the follower prefetches and pauses. */
export const REGION_PREFETCH_FRACTION=.3,REGION_PAUSE_FRACTION=.85;
/** A failed window is re-requested after these backoffs; following stops only once this many fail in a row.
 * CStreaming never gives up on a sector, so one bad reply (a transient decode error, a support miss while the
 * car is airborne) must not strand the player at the edge of the loaded world. */
export const REGION_RETRY_MS=[500,2000,5000],REGION_FAILURE_LIMIT=REGION_RETRY_MS.length;
const clock=()=>typeof performance!=='undefined'?performance.now():0;
export class SceneRegionFollower {
 private region:SceneRegion;
 private pending:{id:number;region:SceneRegion}|undefined;
 private enabled=true;
 private requests=0;
 private failures=0;
 private retryAt=0;
 private requestedRadius?:number;
 private requestedLodRadius?:number;
 setRadius(radius:number,lodRadius?:number){requireAsset(Number.isFinite(radius)&&radius>=32&&radius<=1000,'Invalid following radius.');requireAsset(lodRadius===undefined||Number.isFinite(lodRadius)&&lodRadius>=radius&&lodRadius<=3000,'Invalid distant following radius.');this.requestedRadius=radius;this.requestedLodRadius=lodRadius;}
 constructor(region:SceneRegion){
  requireAsset(region&&[region.x,region.y,region.radius].every(Number.isFinite)&&Math.abs(region.x)<=1e7&&Math.abs(region.y)<=1e7&&region.radius>=32&&region.radius<=1000,'Following terrain requires a 32–1000 unit region.');
  this.setRadius(region.radius,region.lodRadius);
  this.region={x:region.x,y:region.y,radius:region.radius,includeCollisionBounds:true,...(region.lodRadius===undefined?{}:{lodRadius:region.lodRadius})};
 }
  /** Seconds of travel the next window is centred ahead of the player: the worker's recent latency plus a margin. */
  leadSeconds=2;
  /** The next call to `request` skips the prefetch-distance check: the start scene asks for its full window (the LOD
   * ring) before the player has moved. */
  primeNext=false;
  request(position:{x:number;z:number},eligible:boolean,velocity?:{x:number;z:number},now=clock()){
   if(!this.enabled||this.pending||!eligible||now<this.retryAt)return;
   const primed=this.primeNext;this.primeNext=false;
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
     // The lead grows with the worker's latency; up to 0.8 radius keeps the player inside the requested window
     // (the current one still covers him behind).
     const shift=Math.min(speed*this.leadSeconds,radius*0.8);
     cx+=velocity.x/speed*shift;cy+=-velocity.z/speed*shift;
    }
   }
   if(!primed&&this.requestedRadius===this.region.radius&&this.requestedLodRadius===this.region.lodRadius&&Math.hypot(cx-this.region.x,cy-this.region.y)<this.region.radius*REGION_PREFETCH_FRACTION)return;
   const next={...this.region,x:cx,y:cy,radius:this.requestedRadius??this.region.radius};
  if(this.requestedLodRadius===undefined)delete next.lodRadius;else next.lodRadius=this.requestedLodRadius;
  this.pending={id:++this.requests,region:next};
  return {id:this.pending.id,region:{...this.pending.region}};
 }
 matches(id:number){return this.enabled&&this.pending?.id===id;}
 /** Past the safety boundary while a window is in flight, or while a failed one waits for its retry. */
 needsPause(position:{x:number;z:number}){
  return this.enabled&&(!!this.pending||this.failures>0)&&Math.hypot(position.x-this.region.x,-position.z-this.region.y)>=this.region.radius*REGION_PAUSE_FRACTION;
 }
 finish(id:number,success:boolean,now=clock()){
  if(!this.matches(id))return false;
  if(success){this.region=this.pending!.region;this.failures=0;this.retryAt=0;}
  else if(++this.failures>=REGION_FAILURE_LIMIT)this.enabled=false;
  else this.retryAt=now+REGION_RETRY_MS[this.failures-1];
  this.pending=undefined;return true;
 }
 stop(){this.enabled=false;this.pending=undefined;}
 snapshot(){return {enabled:this.enabled,requests:this.requests,pending:this.pending?.id??null,failures:this.failures,retryAt:this.retryAt,region:{...this.region}};}
}
