import type RAPIER from '@dimforge/rapier3d-compat';
import type {Vec3} from '../core/math';
import {requireAsset} from '../assets/binary';
const f=(n:number)=>{const value=Math.fround(n);requireAsset(Number.isFinite(value),'Nonfinite suspension value.');return value;};
export interface NativeSuspensionLine {start:Vec3;end:Vec3;springLength:number;lineLength:number;radius:number}
/** Ordinary automobile SetupSuspensionLines, in local native Z-up coordinates.
 * Wheel size is the source diameter. Special quad/tank/hydraulic geometry is separate. */
export function nativeSuspensionLine(wheel:Vec3,upper:number,lower:number,wheelSize:number):NativeSuspensionLine{
  upper=f(upper);lower=f(lower);wheelSize=f(wheelSize);
  requireAsset(upper>lower&&wheelSize>0,'Suspension requires positive travel and wheel size.');
  const radius=f(wheelSize/2),start={x:f(wheel.x),y:f(wheel.y),z:f(f(wheel.z)+upper)};
  const end={x:start.x,y:start.y,z:f(f(f(wheel.z)+lower)-radius)};
  const springLength=f(upper-lower),lineLength=f(start.z-end.z);
  requireAsset(lineLength>springLength,'Suspension line lost its wheel-radius extent.');
  return {start,end,springLength,lineLength,radius};
}
/** Source converts the collision-line hit fraction into spring compression before
 * ProcessSuspension. Negative compression is possible; do not clamp it away. */
export function nativeSuspensionCompression(hitFraction:number,springLength:number,lineLength:number):number{
  hitFraction=f(hitFraction);springLength=f(springLength);lineLength=f(lineLength);
  requireAsset(hitFraction>=0&&hitFraction<=1&&springLength>0&&lineLength>=springLength,'Invalid suspension fraction or lengths.');
  const radiusFraction=f(1-f(springLength/lineLength)),denominator=f(1-radiusFraction);
  requireAsset(denominator>0,'Suspension travel is below float32 precision.');
  return f(f(hitFraction-radiusFraction)/denominator);
}
/** Adapter for a raycast wheel configured with this line's upper endpoint, spring
 * travel as rest length and radius. Read before either body moves. Rapier's clamped
 * suspension length is deliberately not used as the collision-line fraction. */
export function sampleNativeSuspensionCompression(controller:RAPIER.DynamicRayCastVehicleController,index:number,line:NativeSuspensionLine):number{
  requireAsset(Number.isInteger(index)&&index>=0&&index<controller.numWheels(),'Invalid suspension wheel index.');
  const rest=controller.wheelSuspensionRestLength(index),radius=controller.wheelRadius(index);
  requireAsset(rest!==null&&radius!==null&&Math.abs(rest-line.springLength)<1e-5&&Math.abs(radius-line.radius)<1e-5,'Wheel geometry does not match native suspension.');
  if(!controller.wheelIsInContact(index))return nativeSuspensionCompression(1,line.springLength,line.lineLength);
  const start=controller.wheelHardPoint(index),hit=controller.wheelContactPoint(index);
  requireAsset(start&&hit,'Suspension contact is missing raycast geometry.');
  const distance=f(Math.hypot(hit.x-start.x,hit.y-start.y,hit.z-start.z));
  return nativeSuspensionCompression(f(distance/line.lineLength),line.springLength,line.lineLength);
}
