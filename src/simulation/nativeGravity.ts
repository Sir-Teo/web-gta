import {requireAsset} from '../assets/binary';
import type {NativeVelocityDelta} from './nativeWheelMotion';
export interface NativeGravityFlags {applyGravity:boolean;disableMoveForce:boolean;usesCollision:boolean}
/** CPhysical::ApplyGravity ordinary finite-mass branch. Infinite-mass torque,
 * attachment/status scheduling and air resistance are separate concerns. */
export function nativeGravity(timeStep:number,flags:NativeGravityFlags):NativeVelocityDelta{
  const dt=Math.fround(timeStep);requireAsset(Number.isFinite(dt)&&dt>=0&&dt<=3,'Invalid native gravity timestep.');
  const z=flags.applyGravity&&!flags.disableMoveForce&&flags.usesCollision?-Math.fround(dt*Math.fround(.008)):0;
  return {linear:{x:0,y:0,z},angular:{x:0,y:0,z:0}};
}
/** CPhysical::ApplyGravity's 0.008 units per 50 Hz frame squared, in m/s² (20). Every vehicle falls at this, as the
 * automobile's own ApplyGravity does: bikes and boats that fell at 9.81 floated off jumps and waves at half the weight of
 * a car. The authored aircraft flight equations keep their own balance of lift against 9.81. */
export const NATIVE_GRAVITY_MS2=Math.fround(.008)*50*50;
