import type RAPIER from '@dimforge/rapier3d-compat';
import type {Vec3} from '../core/math';
import {requireAsset} from '../assets/binary';
import {sampleNativeChassis} from './nativeChassis';
import {NATIVE_CAR_WHEELS,type CarWheel} from './nativeDriveContacts';
import type {NativeSuspensionLine} from './nativeSuspension';
/** Ordinary collision-line branch of the airborne contact-point setup. Surface
 * normal and ground speed stay explicitly caller-owned; no stale ray is queried. */
export function sampleNativeWheelFallbacks(body:RAPIER.RigidBody,lines:Record<CarWheel,NativeSuspensionLine>,surfaces:Partial<Record<CarWheel,{normal:Vec3;groundSpeed:Vec3}>>){
  const c=sampleNativeChassis(body),result:Partial<Record<CarWheel,{point:Vec3;normal:Vec3;groundSpeed:Vec3}>>={};
  const f=(n:number)=>{const v=Math.fround(n);requireAsset(Number.isFinite(v),'Nonfinite wheel fallback.');return v;};
  const vector=(v:Vec3)=>({x:f(v.x),y:f(v.y),z:f(v.z)});
  for(const wheel of NATIVE_CAR_WHEELS){
    const surface=surfaces[wheel];if(!surface)continue;
    const p=vector(lines[wheel].end),normal=vector(surface.normal),groundSpeed=vector(surface.groundSpeed);
    requireAsset(Math.abs(normal.x**2+normal.y**2+normal.z**2-1)<1e-5,'Wheel fallback requires a unit surface normal.');
    const axis=(key:keyof Vec3)=>f(f(f(c.right[key]*p.x)+f(c.forward[key]*p.y))-f(c.direction[key]*p.z));
    result[wheel]={point:{x:axis('x'),y:axis('y'),z:axis('z')},normal,groundSpeed};
  }
  return result;
}
