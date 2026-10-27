type Vec=readonly number[];
type Point=[number,number,number];
const f=Math.fround;
const sub=(a:Vec,b:Vec):Point=>[f(f(a[0])-f(b[0])),f(f(a[1])-f(b[1])),f(f(a[2])-f(b[2]))];
const dot=(a:Vec,b:Vec)=>f(f(f(a[0]*b[0])+f(a[1]*b[1]))+f(a[2]*b[2]));
const length=(a:Vec)=>f(Math.sqrt(dot(a,a)));
export interface DriveByAimTarget {position:Vec;state?:number;self?:boolean;sameVehicle?:boolean}
export interface DriveByAimInput {
 start:Vec;end:Vec;owner:Vec;vehicle:Vec;subtype:number;model:number;
 hasOwner:boolean;aimVehicles:boolean;
 /** Declared CWorld query results, in pool/sector order, before target filtering. */
 peds:readonly DriveByAimTarget[];vehicles:readonly DriveByAimTarget[];
}
/** CVehicle::GetPlaneGunsAutoAimAngle, 0x100483b34. Ordinary bikes return zero. */
export function planeGunsAutoAimAngle(model:number){
 switch(model){case 425:return 25;case 447:return 10;case 464:return 30;case 476:case 487:case 497:case 520:case 548:case 576:return 15;case 564:return 20;default:return 0;}
}
/** CCollision::DistToLine 0x10017fd10, including segment endpoints and negative-square clamp. */
function lineDistance(start:Vec,end:Vec,point:Vec){
 const direction=sub(end,start),relative=sub(point,start),projection=dot(direction,relative);
 if(projection<=0)return length(relative);
 const square=dot(direction,direction);if(projection>=square)return length(sub(point,end));
 const residual=f(dot(relative,relative)-f(f(projection*projection)/square));return residual>0?f(Math.sqrt(residual)):0;
}
/** CWeapon::DoDriveByAutoAiming 0x10049859c. Spatial query membership/order is caller work. */
export function driveByAutoAim(input:DriveByAimInput){
 const {start,end}=input,unchanged=()=>end.map(f) as Point;
 if(!input.hasOwner)return {end:unchanged(),index:undefined,score:10000,threshold:undefined};
 const candidates=[...input.peds.slice(0,16).map(target=>({target,ped:true})),...(input.aimVehicles?input.vehicles.slice(0,16).map(target=>({target,ped:false})):[])],direction=sub(end,start);
 let score=10000,index:number|undefined;
 for(const [i,{target,ped}] of candidates.entries()){
  if(target.self||ped&&(target.state===54||target.state===55||target.sameVehicle))continue;
  const distance=lineDistance(start,end,target.position),value=input.subtype===3||input.subtype===4?f(distance/Math.max(5,length(sub(target.position,input.vehicle)))):f(distance+f(length(sub(target.position,input.owner))*f(.15)));
  if(dot(direction,sub(target.position,start))>0&&value<score){score=value;index=i;}
 }
 const angle=planeGunsAutoAimAngle(input.model),threshold=angle>.5?f(Math.tan(f(f(f(angle)*f(Math.PI))/180))):2.5;
 if(index===undefined||!(score<threshold))return {end:unchanged(),index:undefined,score,threshold};
 const delta=sub(candidates[index].target.position,start),scale=f(length(direction)/length(delta));
 return {end:delta.map((v,i)=>f(f(start[i])+f(v*scale))) as Point,index,score,threshold};
}
