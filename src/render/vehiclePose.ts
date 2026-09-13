import {Quaternion,type Object3D} from 'three';
import type {Vehicle} from '../simulation/Simulation';
const current=new Quaternion();
/** Both pose components use the same fixed-step endpoints. SLERP takes the
 * shortest rotation path, including yaw crossings at +/- pi. */
export function interpolateVehiclePose(root:Object3D,vehicle:Pick<Vehicle,'body'|'previous'|'previousRotation'>,alpha:number){
  const p=vehicle.body.translation(),a=vehicle.previous;
  root.position.set(a.x+(p.x-a.x)*alpha,a.y+(p.y-a.y)*alpha,a.z+(p.z-a.z)*alpha);
  current.copy(vehicle.body.rotation());
  root.quaternion.copy(vehicle.previousRotation).slerp(current,alpha);
}
