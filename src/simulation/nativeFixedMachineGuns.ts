import {vehicleGunReady} from './nativeHunterGun';
type Vec=[number,number,number];
const f=Math.fround;
const sub=(a:readonly number[],b:readonly number[]):Vec=>[f(f(a[0])-f(b[0])),f(f(a[1])-f(b[1])),f(f(a[2])-f(b[2]))];
const dot=(a:Vec,b:Vec)=>f(f(f(a[0]*b[0])+f(a[1]*b[1]))+f(a[2]*b[2]));
const length=(v:Vec)=>f(Math.sqrt(dot(v,v)));
const length2=(v:Vec)=>f(Math.sqrt(f(f(v[0]*v[0])+f(v[1]*v[1]))));
export interface FixedGunAimTarget {position:Vec;radius:number;status?:number;scorched?:boolean;self?:boolean}
export interface FixedGunShot {start:Vec;end:Vec;intensity:number}
/** Native CCollision point-to-segment distance, with native Z zeroed by DoTankDoomAiming. */
function lineDistance(start:Vec,end:Vec,point:Vec){
 const a:Vec=[start[0],start[1],0],b:Vec=[end[0],end[1],0],p:Vec=[point[0],point[1],0],ab=sub(b,a),ap=sub(p,a),projection=dot(ab,ap);
 if(projection<=0)return length(ap);
 const distanceSq=dot(ab,ab);if(projection>=distanceSq)return length(sub(p,b));
 const square=f(dot(ap,ap)-f(f(projection*projection)/distanceSq));return square>0?f(Math.sqrt(square)):0;
}
/** CWeapon::DoTankDoomAiming, PC retail delegate 0x73D1E0; selected iOS 0x10049a930.
 * Vehicles use native XYZ. Candidate order follows the host pool; native sector ordering remains a host boundary. */
export function aimFixedMachineGun(vehicle:Vec,start:Vec,end:Vec,candidates:readonly FixedGunAimTarget[]):Vec{
 const delta=sub(end,start),range=length(delta),radiusSq=f(range*range),slope=f(delta[2]/range);
 let count=0,best=10000,target:FixedGunAimTarget|undefined;
 for(const candidate of candidates){
  const p=candidate.position,from=sub(p,start);
  // FindObjectsInRange is a 2D vehicle-only query capped to 15, before self/train/scorched filters.
  if(f(f(from[0]*from[0])+f(from[1]*from[1]))>radiusSq)continue;
  if(count++>=15)break;
  if(candidate.self||candidate.status===6||candidate.status===7||candidate.scorched)continue;
  const d=sub(vehicle,p),distance=length2(d),height=Math.abs(f(f(vehicle[2])-f(f(slope*distance)+f(p[2]))));
  if(f(height*3)>=distance||lineDistance(start,end,p)>=f(f(candidate.radius)*3))continue;
  const score=f(Math.sqrt(f(f(distance*distance)+f(height*height))));
  if(score<best){best=score;target=candidate;}
 }
 if(!target||best>=9000)return [...end];
 const line=length2(delta),to=sub(target.position,start),distance=length2(to);
 return [end[0],end[1],f(f(start[2])+f(f(line/distance)*f(f(f(target.position[2])+f(.3))-f(start[2]))))];
}
/** CVehicle::DoFixedMachineGuns / FireFixedMachineGuns (PC 0x73F400 / 0x73DF00).
 * The fixed twin guns are distinct from FirePlaneGuns: intensity 15, 150 ms volleys and a 20-volley clip. */
export class NativeFixedMachineGuns {
 lastShotMs=0;clip=20;
 step(nowMs:number,pressed:boolean,forward:boolean,gunOff:boolean,matrix:ReadonlyArray<number>|(()=>ReadonlyArray<number>),random:()=>number,onRound?:(shot:FixedGunShot)=>void):FixedGunShot[]{
  nowMs>>>=0;if(!forward)return [];
  if(!pressed||gunOff){if(vehicleGunReady(nowMs,this.lastShotMs,1400))this.clip=20;return [];}
  if(!vehicleGunReady(nowMs,this.lastShotMs,150))return [];
  this.lastShotMs=nowMs;
  const m=typeof matrix==='function'?matrix():matrix;
  const fx=f(m[4]),fy=f(m[5]),divisor=Math.max(f(.1),f(Math.sqrt(f(f(fx*fx)+f(fy*fy))))),dx=f(f(fx/divisor)*60),dy=f(f(fy/divisor)*60);
  const transform=(x:number):Vec=>[0,1,2].map(i=>{
   const right=f(f(m[i])*x),forward=f(f(m[4+i])*f(2.5)),up=f(m[8+i]);return f(f(m[12+i])+f(f(right+forward)+up));
  }) as Vec;
  const shots=[2,-2].map(x=>{
   const start=transform(x),base:Vec=[f(start[0]+dx),f(start[1]+dy),f(start[2]+0)];
   const spread=([f(.015),f(.015),f(.02)] as const).map(scale=>f(((random()&255)-128)*scale));
   const shot={start,end:[f(base[0]+spread[0]),f(base[1]+spread[1]),f(base[2]+spread[2])] as Vec,intensity:15};onRound?.(shot);return shot;
  });
  this.clip=(this.clip-1)&255;if(!this.clip){this.clip=20;this.lastShotMs=(nowMs+1400)>>>0;}
  return shots;
 }
}
