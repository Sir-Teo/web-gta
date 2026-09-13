import type {Vec3} from '../core/math';
import {requireAsset} from '../assets/binary';
import {NATIVE_CAR_WHEELS,type CarWheel} from './nativeDriveContacts';
import {nativeSpringForce,nativeSpringDamping,nativeForceVelocityDelta,type NativeSpringInput} from './nativeSpring';
import type {NativeVelocityDelta} from './nativeWheelMotion';
const f=(n:number)=>{const r=Math.fround(n);requireAsset(Number.isFinite(r),'Nonfinite suspension frame.');return r;};
const vec=(v:Vec3):Vec3=>({x:f(v.x),y:f(v.y),z:f(v.z)});
const add=(a:Vec3,b:Vec3):Vec3=>({x:f(a.x+b.x),y:f(a.y+b.y),z:f(a.z+b.z)});
const sub=(a:Vec3,b:Vec3):Vec3=>({x:f(a.x-b.x),y:f(a.y-b.y),z:f(a.z-b.z)});
const cross=(a:Vec3,b:Vec3):Vec3=>({x:f(f(a.y*b.z)-f(a.z*b.y)),y:f(f(a.z*b.x)-f(a.x*b.z)),z:f(f(a.x*b.y)-f(a.y*b.x))});
export interface SuspensionFrameWheel {
  compression:number;point:Vec3;normal:Vec3;groundSpeed:Vec3;forceLevel:number;bias:number;damping:number;
}
export interface NativeSuspensionFrameInput {
  linear:Vec3;angular:Vec3;centerOfMass:Vec3;mass:number;turnMass:number;
  direction:Vec3;timeStep:number;mode:NativeSpringInput['mode'];makeMassTwiceAsBig:boolean;
  frameLimit:number;springLimitMultiplier:number;
  /** Undefined means no current suspension contact, independent of tire retention. */
  wheels:Record<CarWheel,SuspensionFrameWheel|undefined>;
}
/** One ordinary four-wheel suspension pass. Compute without body writes: springs
 * first, then one relative-speed snapshot, then damping with updated chassis speed.
 * Inputs/outputs are world-aligned native axes and native velocity units. */
export function stepNativeSuspensionFrame(input:NativeSuspensionFrameInput){
  let linear=vec(input.linear),angular=vec(input.angular);
  const center=vec(input.centerOfMass),motions:NativeVelocityDelta[]=[];
  const springs:Partial<Record<CarWheel,ReturnType<typeof nativeSpringForce>>>={},relative:Partial<Record<CarWheel,Vec3>>={},damping:Partial<Record<CarWheel,ReturnType<typeof nativeSpringDamping>>>={};
  requireAsset(Number.isFinite(input.mass)&&input.mass>0&&Number.isFinite(input.turnMass)&&input.turnMass>0,'Invalid suspension frame mass.');
  const speed=(point:Vec3)=>add(linear,cross(angular,sub(vec(point),center)));
  const apply=(delta:NativeVelocityDelta)=>{linear=add(linear,delta.linear);angular=add(angular,delta.angular);motions.push(delta);};
  for(const wheel of NATIVE_CAR_WHEELS){
    const w=input.wheels[wheel];if(!w)continue;
    requireAsset(Number.isFinite(w.compression)&&w.compression<1,'Suspension contact requires compression below one.');
    const spring=nativeSpringForce({...input,...w});springs[wheel]=spring;
    apply(nativeForceVelocityDelta({force:spring.force,point:w.point,centerOfMass:center,mass:input.mass,turnMass:input.turnMass}));
  }
  for(const wheel of NATIVE_CAR_WHEELS){const w=input.wheels[wheel];if(w)relative[wheel]=sub(speed(w.point),vec(w.groundSpeed));}
  for(const wheel of NATIVE_CAR_WHEELS){
    const w=input.wheels[wheel],spring=springs[wheel];if(!w||!spring)continue;
    const normal=spring.normal,direction=normal.z>Math.fround(.35)?{x:f(-normal.x),y:f(-normal.y),z:f(-normal.z)}:input.direction;
    const result=nativeSpringDamping({...input,...w,direction,centerOfMass:center,relativeSpeed:relative[wheel]!,currentSpeed:speed(w.point),springForceLimit:spring.dampingLimit});
    damping[wheel]=result;apply(result.delta);
  }
  return {linear,angular,motions,springs,relative,damping};
}
