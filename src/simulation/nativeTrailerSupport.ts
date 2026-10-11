import type {Vec3} from '../core/math';
import type {CarWheel} from './nativeDriveContacts';
import type {NativeSuspensionLine} from './nativeSuspension';
import {stepNativeSuspensionFrame,type SuspensionFrameWheel} from './nativeSuspensionFrame';
/* CTrailer's support legs (gta-reversed Trailer.cpp). A trailer is a CAutomobile whose four wheels sit at its back; at
 * its front two more collision lines stand for the legs it rests on while nothing tows it. SetupSuspensionLines puts
 * them at the front corners of the collision bounds, from the top of the bounds down to a depth chosen so the trailer
 * stands level with its weight shared between the legs and the wheels; ProcessSuspension, after the car's own wheels,
 * springs each leg that touches (ApplySpringCollisionAlt, force 1.5, along the trailer's down axis, at the contact's
 * share of the leg) and damps it (ApplySpringDampening, 0.1). ProcessControl extends the legs, while nothing tows the
 * trailer, by 0.002 a timestep (0.0005 while still under a tenth out) to their full length, and retracts them by 0.002
 * while a tractor does. The baggage trailers (BAGBOXA, BAGBOXB) stand on four wheels and have no legs. */
export const TRAILER_SUSPENSION_FORCE=1.5,TRAILER_DAMPING_FORCE=.1;
export const TRAILER_SUPPORT_EXTENSION_RATE=.002,TRAILER_SUPPORT_WAIT_EXTENSION_RATE=.0005,TRAILER_SUPPORT_RETRACTION_RATE=.002;
/** MODEL_BAGBOXA and MODEL_BAGBOXB: BAGGAGE_TRAILER_TOWED_RATIO, no legs. */
export const BAGGAGE_TRAILERS:ReadonlySet<number>=new Set([606,607]);
const f=Math.fround;
export interface TrailerSupportLine {start:Vec3;end:Vec3}
/** CTrailer::SetupSuspensionLines (0x6CF1A0): the two support lines in the model's native frame, from its wheel lines,
 * collision bounds, handling suspension force and front wheel size. */
export function trailerSupportLines(wheels:Record<CarWheel,NativeSuspensionLine>,bounds:{min:readonly number[];max:readonly number[]},suspensionForce:number,frontWheelSize:number):[TrailerSupportLine,TrailerSupportLine]{
 const start=(i:number):Vec3=>({x:f(i===0?bounds.min[0]:-bounds.min[0]),y:f(bounds.max[1]),z:f(bounds.max[2])});
 const supportLegY=Math.abs(bounds.max[1]),avgWheelY=f(f(Math.abs(wheels.frontLeft.start.y)+Math.abs(wheels.rearLeft.start.y))*.5);
 const weightRatio=f(supportLegY/f(avgWheelY+supportLegY));
 const heightAboveRoad=f(f(f(wheels.frontLeft.springLength*f(1-f(weightRatio/f(suspensionForce*4))))+f(frontWheelSize/2))-wheels.frontLeft.start.z);
 const top=start(0).z,endZ=f(top-f(f(top+heightAboveRoad)/f(1-f(f(1-weightRatio)/f(TRAILER_SUSPENSION_FORCE*2)))));
 return [0,1].map(i=>({start:start(i),end:{...start(i),z:endZ}})) as [TrailerSupportLine,TrailerSupportLine];
}
/** ProcessControl's leg travel for one step of `timeStep` (CTimer units): out toward 1 untowed, in toward 0 towed. */
export function stepTrailerSupportExtension(extension:number,towed:boolean,timeStep:number){
 if(towed)return extension>0?Math.max(f(extension-timeStep*TRAILER_SUPPORT_RETRACTION_RATE),0):extension;
 if(extension>=1)return extension;
 return Math.min(f(extension+timeStep*(extension<=.1?TRAILER_SUPPORT_WAIT_EXTENSION_RATE:TRAILER_SUPPORT_EXTENSION_RATE)),1);
}
export interface TrailerSupportContact {
 /** Where along the leg (0 at its top, 1 at its foot) the ground was met. */
 share:number;
 /** The contact point as an offset from the vehicle's origin, and the ground's normal (world-aligned native axes). */
 point:Vec3;normal:Vec3;
}
/** CTrailer::ProcessSuspension's support part (0x6CF6A0): each leg touching nearer than the legs' reach springs and is
 * damped, in one suspension frame like the wheels' own. Native axes and velocity units; the velocity changes come back
 * to apply to the body. */
export function stepTrailerSupport(input:{
 linear:Vec3;angular:Vec3;centerOfMass:Vec3;mass:number;turnMass:number;down:Vec3;timeStep:number;
 /** m_fTrailerTowedRatio2: how far out the legs reach (a contact counts nearer than it). */
 reach:number;
 contacts:readonly (TrailerSupportContact|undefined)[];
 frameLimit:number;springLimitMultiplier:number;
}){
 const leg=(c:TrailerSupportContact|undefined):SuspensionFrameWheel|undefined=>{
  if(!c||!(input.reach>.1)||!(c.share<input.reach))return undefined;
  return {compression:f(c.share/input.reach),point:c.point,normal:c.normal,groundSpeed:{x:0,y:0,z:0},forceLevel:TRAILER_SUSPENSION_FORCE,bias:1,damping:TRAILER_DAMPING_FORCE};
 };
 const wheels={frontLeft:leg(input.contacts[0]),frontRight:leg(input.contacts[1]),rearLeft:undefined,rearRight:undefined};
 if(!wheels.frontLeft&&!wheels.frontRight)return [];
 return stepNativeSuspensionFrame({linear:input.linear,angular:input.angular,centerOfMass:input.centerOfMass,mass:input.mass,turnMass:input.turnMass,
  direction:input.down,timeStep:input.timeStep,mode:'normal',makeMassTwiceAsBig:false,frameLimit:input.frameLimit,springLimitMultiplier:input.springLimitMultiplier,wheels}).motions;
}
