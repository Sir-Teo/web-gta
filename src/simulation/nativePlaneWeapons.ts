import type {Vec3} from '../core/math';

/** CCarCtrl::TestWhetherToFirePlaneGuns (iOS 0x10019fa50) and TestWhetherToFirePlaneMissiles
 * (0x10019fb60). These use the target's current position, independently of the steering's prediction.
 * Coordinates may use either orthonormal world basis. The missile check has no model or weapon-selection gate. */
export function planeWeaponRequests(position:Vec3,forward:Vec3,target:Vec3|undefined,selection:number,nowMs:number,previousMs:number){
 if(!target)return {guns:false,missile:false};
 const dx=target.x-position.x,dy=target.y-position.y,dz=target.z-position.z,d=Math.hypot(dx,dy,dz);
 const ahead=d>0&&(dx*forward.x+dy*forward.y+dz*forward.z)/d>Math.fround(.8);
 return {guns:ahead&&d<150&&(selection===0||selection===1),
  missile:ahead&&d>30&&d<160&&Math.floor(nowMs/2000)!==Math.floor(previousMs/2000)};
}
