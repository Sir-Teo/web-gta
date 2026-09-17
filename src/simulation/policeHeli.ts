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
 * rudder faces the suspect (CHeli pursuit/search with collective/cyclic
 * rotor states; see docs/research/NATIVE_POLICE.md). */
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
/** SWAT rope insertion (CHeli rappel): two officers fast-rope to the street.
 * The browser grounds the stick beneath a low hovering airframe with a
 * visible rope line; the descent follows the rappel timing. */
export const RAPPEL_MIN_STARS = 5;
export const RAPPEL_COOLDOWN = 60;
export const RAPPEL_RADIUS = 80;
export const RAPPEL_MIN_ALTITUDE = 8;
export const RAPPEL_MAX_ALTITUDE = 45;
export function rappelWindow(o:{level:number;sinceRappel:number;lateral:number;altitude:number}){
 return o.level>=RAPPEL_MIN_STARS&&o.sinceRappel>RAPPEL_COOLDOWN&&o.lateral<RAPPEL_RADIUS&&o.altitude>RAPPEL_MIN_ALTITUDE&&o.altitude<RAPPEL_MAX_ALTITUDE;
}
/** Suspect-relative hover point: orbit offset ahead of the suspect's motion. */
export function heliOrbitPoint(suspect:V3,seconds:number):V3{
 const angle=seconds*0.35;
 return {x:suspect.x+Math.cos(angle)*HELI_ORBIT_RADIUS,y:suspect.y+HELI_HOVER_HEIGHT,z:suspect.z+Math.sin(angle)*HELI_ORBIT_RADIUS};
}
/** CHeli flight model: rotor-speed-gated collective/cyclic response with
 * bank-limited turns and vertical-velocity damping (gta-reversed CHeli). */
export const CHELI_ROTOR_FULL = 0.22;
export const CHELI_MAX_BANK = 0.5;
export const CHELI_CLIMB_RATE = 8;
export function cheliInputs(o:{position:V3;velocity:V3;heading:number;rotor:number},target:V3,dt:number):PlaneControls & {rotor:number}{
 const rotor=clamp(o.rotor+dt*0.4,0,CHELI_ROTOR_FULL)/CHELI_ROTOR_FULL;
 const base=policeHeliInputs(o,target);
 return {...base,pitch:clamp(base.pitch,-CHELI_MAX_BANK,CHELI_MAX_BANK),roll:clamp(base.roll,-CHELI_MAX_BANK,CHELI_MAX_BANK),rotor};
}
/** Helicopter searchlight: tracks the suspect within 120 m at night or 3+
 * stars, locking when line-of-sight holds; the cone exposes the suspect and
 * pins the pursuit to the lit position. */
export const SEARCHLIGHT_RANGE = 120;
export const SEARCHLIGHT_CONE = 0.22;
export function searchlightTarget(heli:{x:number;y:number;z:number},suspect:V3,night:number,wanted:number,obstructed:boolean){
 const d=Math.hypot(suspect.x-heli.x,suspect.y-heli.y,suspect.z-heli.z);
 if(obstructed||d>SEARCHLIGHT_RANGE||(night<0.35&&wanted<3))return {locked:false,illuminated:false,distance:d};
 const aim={x:(suspect.x-heli.x)/Math.max(1e-4,d),y:(suspect.y-heli.y)/Math.max(1e-4,d),z:(suspect.z-heli.z)/Math.max(1e-4,d)};
 const down=-aim.y;
 return {locked:true,illuminated:down>0.35&&d<SEARCHLIGHT_RANGE,distance:d,aim,cone:SEARCHLIGHT_CONE};
}
