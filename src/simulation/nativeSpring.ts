import type {Vec3} from '../core/math';
import {requireAsset} from '../assets/binary';
const f=(n:number)=>{const value=Math.fround(n);requireAsset(Number.isFinite(value),'Nonfinite spring value.');return value;};
const vector=(v:Vec3):Vec3=>({x:f(v.x),y:f(v.y),z:f(v.z)});
const scale=(v:Vec3,n:number):Vec3=>({x:f(v.x*n),y:f(v.y*n),z:f(v.z*n)});
const dot=(a:Vec3,b:Vec3)=>f(f(f(a.x*b.x)+f(a.y*b.y))+f(a.z*b.z));
const cross=(a:Vec3,b:Vec3):Vec3=>({x:f(f(a.y*b.z)-f(a.z*b.y)),y:f(f(a.z*b.x)-f(a.x*b.z)),z:f(f(a.x*b.y)-f(a.y*b.x))});
export interface NativeForceInput {force:Vec3;point:Vec3;centerOfMass:Vec3;mass:number;turnMass:number}
/** Ordinary finite, unconstrained ApplyForce; all vectors use world-aligned native
 * Z-up axes. Point and COM are offsets from the vehicle origin. */
export function nativeForceVelocityDelta(input:NativeForceInput){
  const force=vector(input.force),point=vector(input.point),center=vector(input.centerOfMass),mass=f(input.mass),turnMass=f(input.turnMass);
  requireAsset(mass>0&&turnMass>0,'Spring motion requires positive mass and turn mass.');
  const arm={x:f(point.x-center.x),y:f(point.y-center.y),z:f(point.z-center.z)};
  // Source ApplyForce divides vector components directly, rather than multiplying a reciprocal.
  const divide=(v:Vec3,n:number)=>({x:f(v.x/n),y:f(v.y/n),z:f(v.z/n)});
  return {linear:divide(force,mass),angular:divide(cross(arm,force),turnMass)};
}
export interface NativeSpringInput {
  compression:number;forceLevel:number;bias:number;mass:number;timeStep:number;
  direction:Vec3;normal:Vec3;mode:'normal'|'direction';makeMassTwiceAsBig:boolean;
}
/** Source ApplySpringCollision/Alt. Caller commits the returned normal because
 * Alt may flip it before later suspension damping and tire basis calculations. */
export function nativeSpringForce(input:NativeSpringInput){
  const compression=f(input.compression),level=f(input.forceLevel),bias=f(input.bias),mass=f(input.mass),time=f(input.timeStep);
  requireAsset(level>=0&&bias>=0&&bias<=1&&mass>0&&time>=0,'Invalid spring parameters.');
  requireAsset(input.mode==='normal'||input.mode==='direction','Invalid spring force mode.');
  const direction=vector(input.direction);let normal=vector(input.normal);
  requireAsset(Math.abs(dot(direction,direction)-1)<1e-5&&Math.abs(dot(normal,normal)-1)<1e-5,'Spring force requires unit vectors.');
  const stress=f(1-compression);
  if(stress<=0)return {force:{x:0,y:0,z:0},dampingLimit:0,normal};
  const dt=Math.min(time,3);let dampingLimit:number;
  if(input.mode==='normal'){
    if(dot(direction,normal)>0)normal=scale(normal,-1);
    dampingLimit=f(f(f(f(stress*f(dt*mass))*level)*bias)*f(.016));
    if(input.makeMassTwiceAsBig)dampingLimit=f(dampingLimit*f(.75));
  }else dampingLimit=f(f(f(f(f(stress*mass)*level)*f(.016))*dt)*bias);
  return {force:scale(input.mode==='normal'?normal:direction,input.mode==='normal'?dampingLimit:-dampingLimit),dampingLimit,normal};
}
