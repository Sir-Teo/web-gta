import type {Vec3} from '../core/math';
import {requireAsset} from '../assets/binary';
const f=(n:number)=>{const r=Math.fround(n);requireAsset(Number.isFinite(r),'Nonfinite native air resistance.');return r;};
/** CVehicle::m_fAirResistanceMult (0x8D34A8): 2.5 in the exe, as plugin-sdk's CVehicle.h records it. */
export const VEHICLE_AIR_RESISTANCE_MULT=2.5;
/** CPhysical::ApplyAirResistance's extra factor for every automobile and motorbike: m_fAirResistanceMult while
 * CCullZones::DoExtraAirResistanceForPlayer holds (main sets it from the player's cull-zone flags), else 1. */
export const cullAirResistance={multiplier:1};
export function nativeCarAirResistance(dragMultiplier:number){
  const drag=f(dragMultiplier);requireAsset(drag>=0,'Invalid vehicle drag multiplier.');
  return drag<=f(.01)?drag:f(f(drag/1000)/2);
}
/** CPhysical vehicle branch. Angular damping is per call, not timestep-powered.
 * `extraMultiplier` is the cull-zone factor above. */
export function nativeAirResistance(linear:Vec3,angular:Vec3,timeStep:number,coefficient:number,extraMultiplier=1){
  const v={x:f(linear.x),y:f(linear.y),z:f(linear.z)},w={x:f(angular.x),y:f(angular.y),z:f(angular.z)};
  const dt=f(timeStep),air=f(coefficient),extra=f(extraMultiplier);
  requireAsset(dt>=0&&dt<=3&&air>=0&&extra>=0,'Invalid native air resistance inputs.');
  const magnitude=f(Math.sqrt(f(f(f(v.x*v.x)+f(v.y*v.y))+f(v.z*v.z))));
  const factor=f(Math.pow(f(1-f(extra*f(magnitude*air))),dt));
  const nextLinear={x:f(v.x*factor),y:f(v.y*factor),z:f(v.z*factor)},nextAngular={x:f(w.x*f(.99)),y:f(w.y*f(.99)),z:f(w.z*f(.99))};
  return {linear:nextLinear,angular:nextAngular,factor,delta:{linear:{x:f(nextLinear.x-v.x),y:f(nextLinear.y-v.y),z:f(nextLinear.z-v.z)},angular:{x:f(nextAngular.x-w.x),y:f(nextAngular.y-w.y),z:f(nextAngular.z-w.z)}}};
}
