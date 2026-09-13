import type {Vec3} from '../core/math';
import {requireAsset} from '../assets/binary';
import type {prepareHandling} from './nativeHandling';
import {NATIVE_CAR_WHEELS,stepDriveContacts,type CarWheel,type WheelValues} from './nativeDriveContacts';
import {stepNativeSuspensionFrame,type NativeSuspensionFrameInput} from './nativeSuspensionFrame';
import {stepNativeResolvedWheelFrame,type NativeResolvedWheelFrameInput} from './nativeResolvedWheelFrame';
import type {NativeWheelFrameState,NativeWheelFrameInput} from './nativeWheelFrame';
import {nativeContactBasis} from './nativeWheelContact';
import {nativeSteering} from './nativeSteering';
import {nativeVehicleGrip} from './nativeVehicleGrip';
const f=(n:number)=>{const r=Math.fround(n);requireAsset(Number.isFinite(r),'Nonfinite suspended wheel frame.');return r;};
const sub=(a:Vec3,b:Vec3):Vec3=>({x:f(a.x-b.x),y:f(a.y-b.y),z:f(a.z-b.z)});
const cross=(a:Vec3,b:Vec3):Vec3=>({x:f(f(a.y*b.z)-f(a.z*b.y)),y:f(f(a.z*b.x)-f(a.x*b.z)),z:f(f(a.x*b.y)-f(a.y*b.x))});
const dot=(a:Vec3,b:Vec3)=>f(f(f(a.x*b.x)+f(a.y*b.y))+f(a.z*b.z));
export interface NativeSuspendedWheelInput {
  suspension:NativeSuspensionFrameInput;
  /** Explicit burnout geometry is accepted only with diagnostic steering angles.
   * Source steering derives it from the common chassis and rear-left geometry. */
  tires:Omit<NativeResolvedWheelFrameInput,'contacts'>;
  forward:Vec3;
  /** Choose explicit diagnostic angles OR source steering controls, never both. */
  steering?:WheelValues;
  steeringControl?:{angle:number;secondAngle:number;right:Vec3;playerStatus:boolean;tarmacAdhesion:number};
  /** Current contacts come from suspension. Retained airborne contacts require
   * explicit fallback geometry and ground speed, never a cached ray hit. */
  fallback:Partial<Record<CarWheel,{point:Vec3;normal:Vec3;groundSpeed:Vec3}>>;
}
/** Compose one ordinary suspension pass and resolved tire pass without physical
 * writes. Tire speeds are resampled after all suspension forces. */
export function stepNativeSuspendedWheelFrame(handling:ReturnType<typeof prepareHandling>,previous:NativeWheelFrameState,input:NativeSuspendedWheelInput,alreadySkidding:boolean){
  const s=input.suspension,t=input.tires;
  requireAsset((input.steering!==undefined)!==(input.steeringControl!==undefined),'Choose exactly one steering input mode.');
  requireAsset(!input.steeringControl||t.burnoutGeometry===undefined,'Source steering derives burnout geometry; do not supply a second geometry.');
  requireAsset(s.mass===handling.values.mass&&s.turnMass===handling.values.turnMass&&s.timeStep===t.timeStep,'Suspension/tire physical inputs disagree.');
  for(const wheel of NATIVE_CAR_WHEELS){
    const w=s.wheels[wheel];requireAsset(w?w.compression===t.compression[wheel]:t.compression[wheel]>=1,'Suspension/tire contact compression disagrees.');
  }
  const suspension=stepNativeSuspensionFrame(s),contacts={} as NativeWheelFrameInput['contacts'];
  let steering=input.steering,resolvedSteering:ReturnType<typeof nativeSteering>|undefined;
  if(input.steeringControl){
    const control=input.steeringControl;
    requireAsset(Math.abs(dot(control.right,control.right)-1)<1e-5&&Math.abs(dot(control.right,input.forward))<1e-5,'Steering requires an orthonormal chassis right axis.');
    const retained=stepDriveContacts(previous.drivetrain.contacts,t.compression,handling.values.driveType,t.timeStep);
    const {traction}=nativeVehicleGrip({...t.vehicleGrip,tractionMultiplier:handling.values.tractionMultiplier,velocityFrequency:t.velocityFrequency,acceleration:0});
    resolvedSteering=nativeSteering({...control,forwardSpeed:t.velocity,rightSpeed:dot(suspension.linear,control.right),
      frontLeftContact:retained.counters.frontLeft,rearLeftContact:retained.counters.rearLeft,handbrake:t.wheelParameters.handbrake,
      traction,steeringLockDegrees:handling.values.steeringLock,handlingFlags:handling.values.handlingFlags});
    steering={frontLeft:resolvedSteering.frontAngle,frontRight:resolvedSteering.frontAngle,rearLeft:resolvedSteering.rearAngle,rearRight:resolvedSteering.rearAngle};
  }
  for(const wheel of NATIVE_CAR_WHEELS){
    const geometry=s.wheels[wheel]??input.fallback[wheel];if(!geometry){contacts[wheel]=undefined;continue;}
    const normal=suspension.springs[wheel]?.normal??geometry.normal,basis=nativeContactBasis(input.forward,normal,steering![wheel]);
    if(!basis){contacts[wheel]=undefined;continue;}
    const rotation=cross(suspension.angular,sub(geometry.point,s.centerOfMass));
    const speed=sub({x:f(suspension.linear.x+rotation.x),y:f(suspension.linear.y+rotation.y),z:f(suspension.linear.z+rotation.z)},geometry.groundSpeed);
    contacts[wheel]={...basis,point:geometry.point,centerOfMass:s.centerOfMass,forwardSpeed:dot(speed,basis.forward),rightSpeed:dot(speed,basis.right)};
  }
  let burnoutGeometry=t.burnoutGeometry;
  const burnout=t.wheelParameters.burnout&&handling.values.driveType!=='F'&&(!t.wheelParameters.handbrake||(handling.values.handlingFlags&0x40)!==0);
  if(input.steeringControl&&burnout){
    // ProcessCarWheelPair uses the primary, attenuated angle, even for rear steer.
    // Its turn force precedes the rear contact gate, so airborne fallback is needed.
    const rear=s.wheels.rearLeft??input.fallback.rearLeft;
    requireAsset(rear,'Burnout requires current or fallback rear-left geometry.');
    burnoutGeometry={right:input.steeringControl.right,steerAngle:resolvedSteering!.angle,rearLeftPoint:rear.point,centerOfMass:s.centerOfMass};
  }
  const tires=stepNativeResolvedWheelFrame(handling,previous,{...t,contacts,burnoutGeometry},alreadySkidding);
  return {suspension,tires,contacts,steering,resolvedSteering,state:tires.state,alreadySkidding:tires.alreadySkidding,motions:[...suspension.motions,...tires.motions]};
}
