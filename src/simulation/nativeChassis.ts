import type RAPIER from '@dimforge/rapier3d-compat';
import type {Vec3} from '../core/math';
import {requireAsset} from '../assets/binary';
const f=(n:number)=>{const r=Math.fround(n);requireAsset(Number.isFinite(r),'Nonfinite native chassis snapshot.');return r;};
const native=(v:Vec3):Vec3=>({x:f(v.x),y:f(-v.z),z:f(v.y)});
const velocity=(v:Vec3)=>native({x:f(v.x/50),y:f(v.y/50),z:f(v.z/50)});
const dot=(a:Vec3,b:Vec3)=>f(f(f(a.x*b.x)+f(a.y*b.y))+f(a.z*b.z));
/** Read-only snapshot for a chassis whose local axes use native-to-browser
 * conversion (x,y,z)->(x,z,-y). All returned vectors are world-aligned native axes.
 * Rapier linear/angular velocity are per second; the native solver uses 20 ms. */
export function sampleNativeChassis(body:RAPIER.RigidBody){
  requireAsset(body.isDynamic(),'Native chassis snapshot requires a dynamic body.');
  const q=body.rotation(),p=body.translation(),com=body.worldCom();
  requireAsset([q.x,q.y,q.z,q.w].every(Number.isFinite)&&Math.abs(q.x*q.x+q.y*q.y+q.z*q.z+q.w*q.w-1)<1e-5,'Invalid chassis orientation.');
  const right=native({x:1-2*(q.y*q.y+q.z*q.z),y:2*(q.x*q.y+q.w*q.z),z:2*(q.x*q.z-q.w*q.y)});
  const forward=native({x:-2*(q.x*q.z+q.w*q.y),y:-2*(q.y*q.z-q.w*q.x),z:2*(q.x*q.x+q.y*q.y)-1});
  const direction=native({x:-2*(q.x*q.y-q.w*q.z),y:2*(q.x*q.x+q.z*q.z)-1,z:-2*(q.y*q.z+q.w*q.x)});
  const linear=velocity(body.linvel()),angular=velocity(body.angvel());
  return {linear,angular,centerOfMass:native({x:com.x-p.x,y:com.y-p.y,z:com.z-p.z}),right,forward,direction,forwardSpeed:dot(linear,forward),rightSpeed:dot(linear,right)};
}
