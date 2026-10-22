export type PedScanPoint={x:number;y:number;z:number};
export type PedScanState={position:PedScanPoint;dead:boolean};
/** CEntityScanner (5FFA20), CPedScanner (5FFEF0), CTickCounter: first tick, then every 17 calls.
 * The caller supplies world/sector order; ties keep that order. Deleted references leave holes until refresh. */
export class NativePedScanner<T> {
 private count=0;
 private entries:(T|undefined)[]=[];
 get entities():readonly (T|undefined)[]{return this.entries;}
 tick(observer:T,alive:boolean,player:boolean,range:number,candidates:Iterable<T>,state:(entity:T)=>PedScanState){
  if(!alive)return false;
  const trigger=this.count===0;if(++this.count>16)this.count=0;if(!trigger)return false;
  const from=state(observer).position,limit=Math.fround(Math.fround(range)*Math.fround(range)),found:{entity:T;distance:number}[]=[];
  for(const entity of candidates){if(entity===observer)continue;const candidate=state(entity);if(!player&&candidate.dead)continue;
   const distance=pedScanDistanceSquared(from,candidate.position);if(!(distance<limit))continue;
   const at=found.findIndex(e=>distance<e.distance);if(at<0){if(found.length<16)found.push({entity,distance});}else{found.splice(at,0,{entity,distance});if(found.length>16)found.pop();}
  }
  this.entries=found.map(e=>e.entity);return true;
 }
 forget(entity:T){for(let i=0;i<this.entries.length;i++)if(this.entries[i]===entity)this.entries[i]=undefined;}
}
export function pedScanDistanceSquared(a:PedScanPoint,b:PedScanPoint){const f=Math.fround,x=f(f(b.x)-f(a.x)),y=f(f(b.y)-f(a.y)),z=f(f(b.z)-f(a.z));return f(f(f(x*x)+f(y*y))+f(z*z));}
/** CanPedTargetPoint, pinned iOS 1003482fc: direction uses the target point, range is inclusive 3D 40. */
export function pedCanTargetPoint(from:PedScanPoint,forward:PedScanPoint,to:PedScanPoint){
 const f=Math.fround,x=f(f(to.x)-f(from.x)),y=f(f(to.y)-f(from.y)),z=f(f(to.z)-f(from.z));
 const dot=f(f(f(x*f(forward.x))+f(y*f(forward.y)))+f(z*f(forward.z)));
 return dot>=0&&pedScanDistanceSquared(from,to)<=1600;
}
