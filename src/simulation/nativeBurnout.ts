import type {Vec3} from '../core/math';
import {requireAsset} from '../assets/binary';
import {nativeForceVelocityDelta} from './nativeSpring';
export interface NativeBurnoutGeometry {right:Vec3;steerAngle:number;rearLeftPoint:Vec3;centerOfMass:Vec3}
/** Preserve the source's unusual ApplyTurnForce(contactPoint, scaledRight) order.
 * The source contact point is the FORCE argument; scaledRight is the lever point. */
export function nativeBurnoutMotion(turnMass:number,input:NativeBurnoutGeometry){
  const f=(n:number)=>{const r=Math.fround(n);requireAsset(Number.isFinite(r),'Nonfinite burnout motion.');return r;};
  const mass=f(turnMass),right={x:f(input.right.x),y:f(input.right.y),z:f(input.right.z)};
  requireAsset(mass>0&&Math.abs(right.x**2+right.y**2+right.z**2-1)<1e-5,'Invalid burnout turn mass or right axis.');
  const scalar=f(f(f(Math.min(1,f(3000/mass))*f(-.002))*mass)*f(input.steerAngle));
  const point={x:f(scalar*right.x),y:f(scalar*right.y),z:f(scalar*right.z)};
  const delta=nativeForceVelocityDelta({force:input.rearLeftPoint,point,centerOfMass:input.centerOfMass,mass:1,turnMass:mass});
  return {linear:{x:0,y:0,z:0},angular:delta.angular};
}
