import type {Vec3} from '../core/math';

export interface RcWheelCandidate {
 modelId:number;automobile:boolean;deltaX:number;deltaY:number;simple:boolean;
 compression:readonly number[];frontWheelSize:number;
 /** GetWheelPosn for each of the other car's wheels, transformed into the Bandit's native local frame. */
 wheels:readonly (Vec3|undefined)[];
}
/** RcbanditCheck1CarWheels (iOS 0x10044cf30). Its native body corrects the reference's inverted RC/scan filters,
 * missing absolute distances and use of the Bandit's rather than the other car's suspension compression.
 * The caller walks each automobile once, replacing the repeat-sector scan's de-duplication. */
export function rcBanditHitsCarWheels(min:Vec3,max:Vec3,car:RcWheelCandidate){
 if(!car.automobile||car.modelId===441||Math.abs(car.deltaX)>=10||Math.abs(car.deltaY)>=10)return false;
 const radius=car.frontWheelSize*.25;
 for(let i=0;i<4;i++){
  if(!car.simple&&!(car.compression[i]<1))continue;
  const p=car.wheels[i];if(!p)continue;
  // CCollision::TestSphereBox tests overlap independently on each axis, including tangency, rather than the
  // Euclidean distance to the box's closest point (so its corner test deliberately uses the expanded box too).
  if(p.x+radius>=min.x&&p.x-radius<=max.x&&p.y+radius>=min.y&&p.y-radius<=max.y&&p.z+radius>=min.z&&p.z-radius<=max.z)return true;
 }
 return false;
}
