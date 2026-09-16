import {angleDelta,clamp} from '../core/math';
import type {PlaneControls} from './planeFlight';

type V3={x:number;y:number;z:number};
/** Native police helicopter (POLMAV 497, CWanted::NumOfHelisRequired). */
export const POLICE_HELI_MODEL = 497;
/** CWanted::NumOfHelisRequired: none at two stars, one at three, two above. */
export function helisRequired(level:number){return level<=2?0:level===3?1:2;}
/** Hover height above the suspect and the lateral pursuit offset. */
export const HELI_HOVER_HEIGHT = 30;
export const HELI_ORBIT_RADIUS = 14;
/** Bearing convention shared with the car pursuit: forward is (-sin h, -cos h). */
export function heliHeading(rotation:{x:number;y:number;z:number;w:number}){
 const {x,y,z,w}=rotation;
 return Math.atan2(2*(w*y+x*z),1-2*(x*x+y*y));
}
/** Rotor pursuit controller for the hover flight adapter: collective holds the
 * hover height while pitch/roll tilt toward a closing orbit point and the
 * rudder faces the suspect (CHeli pursuit/search, rappelling not reversed). */
export function policeHeliInputs(o:{position:V3;velocity:V3;heading:number},target:V3):PlaneControls{
 const dx=target.x-o.position.x,dz=target.z-o.position.z,dist=Math.hypot(dx,dz);
 const close=Math.min(12,dist*0.4),des=dist>1?{x:dx/dist*close,z:dz/dist*close}:{x:0,z:0};
 const forward={x:-Math.sin(o.heading),z:-Math.cos(o.heading)},right={x:Math.cos(o.heading),z:-Math.sin(o.heading)};
 const ax=(des.x-o.velocity.x)*0.8,az=(des.z-o.velocity.z)*0.8;
 // Positive pitch brakes toward the tail, positive roll toward the right skid.
 const pitch=clamp(-(ax*forward.x+az*forward.z)*0.12,-1,1);
 const roll=clamp((ax*right.x+az*right.z)*0.12,-1,1);
 const climb=clamp((target.y-o.position.y)*0.15-o.velocity.y*0.25,-1,1);
 const throttle=clamp(0.47+climb*0.3,0,1);
 const rudder=clamp(-angleDelta(o.heading,Math.atan2(-dx,-dz))*1.5,-1,1);
 return {throttle,pitch,roll,rudder,brake:false};
}
/** Suspect-relative hover point: orbit offset ahead of the suspect's motion. */
export function heliOrbitPoint(suspect:V3,seconds:number):V3{
 const angle=seconds*0.35;
 return {x:suspect.x+Math.cos(angle)*HELI_ORBIT_RADIUS,y:suspect.y+HELI_HOVER_HEIGHT,z:suspect.z+Math.sin(angle)*HELI_ORBIT_RADIUS};
}
