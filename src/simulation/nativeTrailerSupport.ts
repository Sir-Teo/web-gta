import type {Vec3} from '../core/math';
import type {CarWheel} from './nativeDriveContacts';
import type {NativeSuspensionLine} from './nativeSuspension';
import {stepNativeSuspensionFrame,type SuspensionFrameWheel} from './nativeSuspensionFrame';
import {nativeWheelResponse,type NativeWheelState} from './nativeWheelResponse';
import {nativeWheelVelocityDelta,type NativeVelocityDelta} from './nativeWheelMotion';
import type {WheelSurfaceInput} from './nativeWheelParameters';
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
 const {weightRatio,heightAboveRoad}=trailerWeightShare(wheels,bounds,suspensionForce,frontWheelSize);
 const top=start(0).z,endZ=f(top-f(f(top+heightAboveRoad)/f(1-f(f(1-weightRatio)/f(TRAILER_SUSPENSION_FORCE*2)))));
 return [0,1].map(i=>({start:start(i),end:{...start(i),z:endZ}})) as [TrailerSupportLine,TrailerSupportLine];
}
/** SetupSuspensionLines' share of the weight on the legs and the height above the road it gives: a CTrailer's
 * m_fFrontHeightAboveRoad and m_fRearHeightAboveRoad both. */
export function trailerWeightShare(wheels:Record<CarWheel,NativeSuspensionLine>,bounds:{max:readonly number[]},suspensionForce:number,frontWheelSize:number){
 const supportLegY=Math.abs(bounds.max[1]),avgWheelY=f(f(Math.abs(wheels.frontLeft.start.y)+Math.abs(wheels.rearLeft.start.y))*.5);
 const weightRatio=f(supportLegY/f(avgWheelY+supportLegY));
 const heightAboveRoad=f(f(f(wheels.frontLeft.springLength*f(1-f(weightRatio/f(suspensionForce*4))))+f(frontWheelSize/2))-wheels.frontLeft.start.z);
 return {weightRatio,heightAboveRoad};
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
/** The real wheel a leg borrows in ProcessCarWheelPair (the front-left wheel for the first leg, the rear-left for the
 * second): whether it touched lately (m_WheelCounts over 0), its ground's normal and surface, and its last state. */
export interface TrailerLegWheel {counted:boolean;normal?:Vec3;surface?:WheelSurfaceInput;state:NativeWheelState}
const dot=(a:Vec3,b:Vec3)=>f(f(f(a.x*b.x)+f(a.y*b.y))+f(a.z*b.z));
const unit=(a:Vec3):Vec3=>{const l=Math.sqrt(dot(a,a));return l>0?{x:f(a.x/l),y:f(a.y/l),z:f(a.z/l)}:{x:1,y:0,z:0};};
/** CTrailer::ProcessSuspension's grip for an untowed trailer (0x6CF6A0's tail): CAutomobile::ProcessCarWheelPair on the
 * front-left and rear-left wheels with the legs' contact points and speeds, no steer and no thrust, a brake of 1000 and
 * a quarter of the handling's base traction (tractionMultiplier × 0.004 × 0.25), a leg off the ground passing as a
 * burst wheel at the origin (which moves nothing). Each wheel's ground, surface, contact memory and state are the real
 * wheel's, as the native reuses them. Speeds and points in native axes; the velocity changes come back to apply. */
export function stepTrailerLegGrip(input:{
 forward:Vec3;linear:Vec3;angular:Vec3;centerOfMass:Vec3;mass:number;turnMass:number;timeStep:number;
 reach:number;contacts:readonly (TrailerSupportContact|undefined)[];wheels:readonly [TrailerLegWheel,TrailerLegWheel];
 /** m_nNumContactWheels. */
 contactWheels:number;alreadySkidding:boolean;
 handling:{tractionMultiplier:number;brakeBias:number;tractionBias:number;tractionLoss:number;suspensionAntiDive:number;handlingFlags:number};
}){
 const h=input.handling,motions:NativeVelocityDelta[]=[];let alreadySkidding=input.alreadySkidding;
 const states:[NativeWheelState,NativeWheelState]=[input.wheels[0].state,input.wheels[1].state];
 // Not the player's: bNpcNeutralHandl sets both biases to 1, as for any car the game drives.
 const neutral=(h.handlingFlags&8)!==0,brake=f(1000*(neutral?1:f(2*h.brakeBias))),tractionBias=neutral?1:f(2*h.tractionBias);
 const traction=f(f(h.tractionMultiplier*.004)*.25);
 for(const i of [0,1] as const){
  const wheel=input.wheels[i],leg=input.contacts[i];
  if(!wheel.counted||!wheel.normal||!wheel.surface||input.contactWheels<1)continue;
  if(!leg||!(input.reach>.1)||!(leg.share<input.reach))continue;
  const n=wheel.normal,along=dot(input.forward,n),fwd=unit({x:input.forward.x-n.x*along,y:input.forward.y-n.y*along,z:input.forward.z-n.z*along});
  const right=unit({x:f(f(fwd.y*n.z)-f(fwd.z*n.y)),y:f(f(fwd.z*n.x)-f(fwd.x*n.z)),z:f(f(fwd.x*n.y)-f(fwd.y*n.x))});
  const lever={x:leg.point.x-input.centerOfMass.x,y:leg.point.y-input.centerOfMass.y,z:leg.point.z-input.centerOfMass.z},w=input.angular;
  const speed={x:input.linear.x+w.y*lever.z-w.z*lever.y,y:input.linear.y+w.z*lever.x-w.x*lever.z,z:input.linear.z+w.x*lever.y-w.y*lever.x};
  const response=nativeWheelResponse({wheel:i===0?'frontLeft':'rearLeft',previousState:wheel.state,alreadySkidding,forwardSpeed:dot(speed,fwd),rightSpeed:dot(speed,right),
   contactCount:Math.min(4,input.contactWheels),thrust:0,brake,coastBrake:0,adhesion:f(f(wheel.surface.adhesiveLimit*traction)*tractionBias),tractionLoss:h.tractionLoss,
   throttle:0,timeStep:input.timeStep,playerControlled:false,antiDive:h.suspensionAntiDive});
  alreadySkidding=response.alreadySkidding;states[i]=response.state;
  if(response.forward!==0||response.right!==0)motions.push(nativeWheelVelocityDelta({response,forward:fwd,right,point:leg.point,centerOfMass:input.centerOfMass,mass:input.mass,turnMass:input.turnMass}));
 }
 return {motions,states,alreadySkidding};
}
