import {Euler,Quaternion,Vector3} from 'three';
import type {PlaneControls} from './nativeFlyingControl';
/** Browser rotor/VTOL adapter with the CHeli flight model: rotor-speed-gated
 * collective lift, velocity-damped cyclic and bank-limited self-leveling. */
export function hoverFlight(velocity:{x:number;y:number;z:number},rotation:{x:number;y:number;z:number;w:number},controls:PlaneControls,rotor01=1){
 const q=new Quaternion().copy(rotation),e=new Euler().setFromQuaternion(q,'YXZ'),hover=controls.brake,lift=hover?9.81:controls.throttle*21*Math.max(0.3,rotor01);
 const acceleration=new Vector3(0,lift,0).applyQuaternion(q);acceleration.x-=velocity.x*(hover?3:.45);acceleration.y-=9.81+velocity.y*(hover?3:.7);acceleration.z-=velocity.z*(hover?3:.45);
 const angular=new Vector3(((hover?0:controls.pitch*.35)-e.x)*2,-controls.rudder*.8,((hover?0:-controls.roll*.35)-e.z)*2).applyQuaternion(q);
 return {acceleration,angular,speed:Math.hypot(velocity.x,velocity.z),stall:false};
}
