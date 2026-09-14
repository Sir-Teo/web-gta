import {Quaternion,Vector3} from 'three';
import type {FlyingHandling} from '../assets/flyingHandling';
export interface PlaneControls {throttle:number;pitch:number;roll:number;rudder:number;brake:boolean}
/** Browser flight adapter in metres/seconds. Source coefficients tune response;
 * this is not the unreconstructed CVehicle::FlyingControl algorithm. */
export function planeFlight(velocity:{x:number;y:number;z:number},rotation:{x:number;y:number;z:number;w:number},controls:PlaneControls,flight:FlyingHandling,gearUp:boolean,grounded:boolean){
 const q=new Quaternion().copy(rotation),inverse=q.clone().invert(),local=new Vector3().copy(velocity).applyQuaternion(inverse),speed=Math.max(0,-local.z),h=flight.values;
 const stallSpeed=Math.max(17,Math.min(36,24*Math.sqrt(.02/Math.max(.006,h.formLift))));
 const authority=Math.min(1,speed/stallSpeed),liftRatio=Math.min(1.7,(speed/stallSpeed)**2);
 const thrust=controls.throttle*(6+h.thrust*10),drag=.0025*speed*speed*(gearUp?h.gearUpResistance:1);
 const acceleration=new Vector3(-local.x*(grounded?5:.65),liftRatio*9.81-local.y*(grounded?0:.8),-thrust+drag+(controls.brake&&grounded?Math.min(speed*3,14):0)).applyQuaternion(q);
 acceleration.y-=9.81;
 const pitchRate=controls.pitch*Math.max(.28,Math.min(1.1,Math.abs(h.pitch)*1800))*authority;
 const rollRate=-controls.roll*Math.max(.3,Math.min(1.6,Math.abs(h.roll)*300))*authority;
 const rudderRate=-controls.rudder*(grounded?.5:.3)*Math.min(1,speed/5);
 const angular=new Vector3(pitchRate,rudderRate,grounded?0:rollRate).applyQuaternion(q);
 // A banked wing curves the flight path; yaw follows that turn without leveling the bank.
 if(!grounded){
  const forward=new Vector3(0,0,-1).applyQuaternion(q);
  const horizontalRight=new Vector3(-forward.z,0,forward.x);
  // Measure bank relative to the flight heading, not the world's east axis.
  // At a vertical attitude there is no defined horizontal heading or bank turn.
  if(horizontalRight.lengthSq()>1e-8){
   horizontalRight.normalize();
   angular.y-=new Vector3(0,1,0).applyQuaternion(q).dot(horizontalRight)*9.81/Math.max(12,speed);
  }
 }
 return {acceleration,angular,speed,stallSpeed,stall:!grounded&&speed<stallSpeed*.75};
}
