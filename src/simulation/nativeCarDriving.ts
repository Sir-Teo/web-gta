import {blendBicycleAssociation,type BicycleAssociation} from './nativeBicycleBlend';
const f=Math.fround;
/** Native default PED descriptors, 0x100624418; IDs 60..98 (table order differs). */
export const CAR_DRIVING_CLIPS:Readonly<Record<number,string>>=Object.fromEntries(['car_sit','car_lsit','car_sit_weak','car_sit_pro','car_sitp','car_sitplo','drive_l','drive_r','drive_lo_l','drive_lo_r','drive_l_weak','drive_r_weak','drive_l_pro','drive_r_pro','driveby_l','driveby_r','drivebyl_l','drivebyl_r','car_lb','car_lb_weak','car_lb_pro','drive_boat','drive_boat_l','drive_boat_r','drive_boat_back','drive_l_slow','drive_r_slow','drive_l_weak_slow','drive_r_weak_slow','drive_l_pro_slow','drive_r_pro_slow','drive_truck','drive_truck_l','drive_truck_r','drive_truck_back','kart_drive','kart_l','kart_r','kart_lb'].map((name,index)=>[60+index,name]).concat([[189,'car_tune_radio']]));
const IDS=new Map(Object.entries(CAR_DRIVING_CLIPS).map(([id,name])=>[name,Number(id)]));
export const carDrivingClipId=(name:string)=>IDS.get(name.toLowerCase());
export function carDrivingAssociationFlags(identifier:number){return identifier===189?28:identifier===81?0x1004:identifier<=65||identifier===91||identifier===95?4:0x1014;}
type Duration=(identifier:number)=>number|undefined;
function blend(associations:BicycleAssociation[],identifier:number,duration:Duration,delta:number){
 const seconds=duration(identifier);if(seconds===undefined||!(seconds>0))return;
 return blendBicycleAssociation(associations,identifier,seconds,delta,0,carDrivingAssociationFlags(identifier));
}
export interface CarDriveByInput {enabled:boolean;fire:number;left:boolean;right:boolean;ammo:number;low:boolean}
/** DoDriveByShootings 0x10049b674 with a null bike ride-data return. Weapon services are caller work. */
export function controlCarDriveBy(associations:BicycleAssociation[],input:CarDriveByInput|undefined,duration:Duration){
 if(!input?.enabled)return;
 const left=input.low?76:74,right=input.low?77:75;
 if((input.left||input.right)&&input.ammo>=1){
  const identifier=input.left?left:right,target=associations.find(a=>a.identifier===identifier);
  if(!target||target.delta<0)blend(associations,identifier,duration,16);
  return identifier;
 }
 for(const a of associations)if(a.identifier===left||a.identifier===right)a.delta=-8;
}
export interface CarDrivingInput {steer:number;reversing:boolean;idleFull:boolean;ride:{left:string;right:string;back:string};driveBy?:boolean;blendRadio?:boolean;cameraBehind?:boolean;offscreen?:boolean;player?:boolean}
/** ProcessDrivingAnims 0x100480498 partial writes. Full-body idle presence/blend and ride set are declared inputs. */
export function controlCarDriving(associations:BicycleAssociation[],input:CarDrivingInput,duration:Duration){
 if(input.offscreen||input.player===false)return;
 let radio=associations.find(a=>a.identifier===189);if(input.blendRadio)radio=blend(associations,189,duration,4);
 if(radio||!input.idleFull)return;
 const ids=[input.ride.left,input.ride.right,input.ride.back].map(carDrivingClipId);if(ids.some(id=>id===undefined))return;
 const [leftId,rightId,backId]=ids as number[],get=(id:number)=>associations.find(a=>a.identifier===id),left=get(leftId),right=get(rightId),back=get(backId),driveBy=input.driveBy||associations.some(a=>a.identifier>=74&&a.identifier<=77);
 if(back&&input.cameraBehind)back.delta=-1000;
 if(input.reversing&&!driveBy){
  if(!input.cameraBehind&&(!back||back.amount<1&&back.delta<=0))blend(associations,backId,duration,4);
  return;
 }
 const steer=f(input.steer);
 if(steer===0||driveBy){for(const a of [left,right,back])if(a)a.delta=-4;return;}
 const used=Math.min(1,Math.max(0,f(steer/f(steer<0?-.61:.61)))),[off,on,onId]=steer<0?[left,right,rightId]:[right,left,leftId];
 if(off){off.amount=0;off.delta=0;}
 if(on){on.amount=used;on.delta=0;}else blend(associations,onId,duration,4);
 if(back)back.delta=-4;
}
const RIDE={weak:[62,70,71,79],weakSlow:[62,87,88,79],low:[61,68,69,78],boat:[81,82,83,84],standard:[60,66,67,78],standardSlow:[60,85,86,78],pro:[63,72,73,80],proSlow:[63,89,90,80],truck:[91,92,93,94],kart:[95,96,97,98]} as const;
/** PC ride tables/tiers from reversed ProcessDrivingAnims and RideAnims.h.
 * The explicit iOS mode retains its native two-tier selector for reference replay. */
export function carDrivingRideIds(input:{low:boolean;boat?:boolean;sitInBoat?:boolean;kart:boolean;truck:boolean;skill:number;velocity:readonly number[]},release:'pc1'|'ios'='pc1'){
 if(input.low)return RIDE.low;if(input.boat&&!input.sitInBoat)return RIDE.boat;if(input.kart)return RIDE.kart;if(input.truck)return RIDE.truck;
 const v=input.velocity.map(f),speed=f(Math.sqrt(f(f(f(v[0]*v[0])+f(v[1]*v[1]))+f(v[2]*v[2])))),skill=f(input.skill),fast=speed>f(.4);
 if(release==='ios'){const pro=skill>=50;return fast?pro?RIDE.pro:RIDE.standard:pro?RIDE.proSlow:RIDE.standardSlow;}
 if(skill<50)return fast?RIDE.weak:RIDE.weakSlow;
 if(skill<100)return fast?RIDE.standard:RIDE.standardSlow;
 return fast?RIDE.pro:RIDE.proSlow;
}
