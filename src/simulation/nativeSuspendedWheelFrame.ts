import type {Vec3} from '../core/math';
import {requireAsset} from '../assets/binary';
import type {prepareHandling} from './nativeHandling';
import {NATIVE_CAR_WHEELS,type CarWheel,type WheelValues} from './nativeDriveContacts';
import {stepNativeSuspensionFrame,type NativeSuspensionFrameInput} from './nativeSuspensionFrame';
import {stepNativeResolvedWheelFrame,type NativeResolvedWheelFrameInput} from './nativeResolvedWheelFrame';
import type {NativeWheelFrameState,NativeWheelFrameInput} from './nativeWheelFrame';
import {nativeContactBasis} from './nativeWheelContact';
const f=(n:number)=>{const r=Math.fround(n);requireAsset(Number.isFinite(r),'Nonfinite suspended wheel frame.');return r;};
const sub=(a:Vec3,b:Vec3):Vec3=>({x:f(a.x-b.x),y:f(a.y-b.y),z:f(a.z-b.z)});
const cross=(a:Vec3,b:Vec3):Vec3=>({x:f(f(a.y*b.z)-f(a.z*b.y)),y:f(f(a.z*b.x)-f(a.x*b.z)),z:f(f(a.x*b.y)-f(a.y*b.x))});
const dot=(a:Vec3,b:Vec3)=>f(f(f(a.x*b.x)+f(a.y*b.y))+f(a.z*b.z));
export interface NativeSuspendedWheelInput {
  suspension:NativeSuspensionFrameInput;
  tires:Omit<NativeResolvedWheelFrameInput,'contacts'>;
  forward:Vec3;steering:WheelValues;
  /** Current contacts come from suspension. Retained airborne contacts require
   * explicit fallback geometry and ground speed, never a cached ray hit. */
  fallback:Partial<Record<CarWheel,{point:Vec3;normal:Vec3;groundSpeed:Vec3}>>;
}
/** Compose one ordinary suspension pass and resolved tire pass without physical
 * writes. Tire speeds are resampled after all suspension forces. */
export function stepNativeSuspendedWheelFrame(handling:ReturnType<typeof prepareHandling>,previous:NativeWheelFrameState,input:NativeSuspendedWheelInput,alreadySkidding:boolean){
  const s=input.suspension,t=input.tires;
  requireAsset(s.mass===handling.values.mass&&s.turnMass===handling.values.turnMass&&s.timeStep===t.timeStep,'Suspension/tire physical inputs disagree.');
  for(const wheel of NATIVE_CAR_WHEELS){
    const w=s.wheels[wheel];requireAsset(w?w.compression===t.compression[wheel]:t.compression[wheel]>=1,'Suspension/tire contact compression disagrees.');
  }
  const suspension=stepNativeSuspensionFrame(s),contacts={} as NativeWheelFrameInput['contacts'];
  for(const wheel of NATIVE_CAR_WHEELS){
    const geometry=s.wheels[wheel]??input.fallback[wheel];if(!geometry){contacts[wheel]=undefined;continue;}
    const normal=suspension.springs[wheel]?.normal??geometry.normal,basis=nativeContactBasis(input.forward,normal,input.steering[wheel]);
    if(!basis){contacts[wheel]=undefined;continue;}
    const rotation=cross(suspension.angular,sub(geometry.point,s.centerOfMass));
    const speed=sub({x:f(suspension.linear.x+rotation.x),y:f(suspension.linear.y+rotation.y),z:f(suspension.linear.z+rotation.z)},geometry.groundSpeed);
    contacts[wheel]={...basis,point:geometry.point,centerOfMass:s.centerOfMass,forwardSpeed:dot(speed,basis.forward),rightSpeed:dot(speed,basis.right)};
  }
  const tires=stepNativeResolvedWheelFrame(handling,previous,{...t,contacts},alreadySkidding);
  return {suspension,tires,contacts,state:tires.state,alreadySkidding:tires.alreadySkidding,motions:[...suspension.motions,...tires.motions]};
}
