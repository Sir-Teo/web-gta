import type RAPIER from '@dimforge/rapier3d-compat';
import type {Vec3} from '../core/math';
import {requireAsset} from '../assets/binary';
import type {nativeWheelResponse} from './nativeWheelResponse';

const f=(n:number)=>{const value=Math.fround(n);requireAsset(Number.isFinite(value),'Nonfinite native wheel motion.');return value;};
const vector=(v:Vec3):Vec3=>({x:f(v.x),y:f(v.y),z:f(v.z)});
const scale=(v:Vec3,n:number):Vec3=>({x:f(v.x*n),y:f(v.y*n),z:f(v.z*n)});
const add=(a:Vec3,b:Vec3):Vec3=>({x:f(a.x+b.x),y:f(a.y+b.y),z:f(a.z+b.z)});
const dot=(a:Vec3,b:Vec3)=>f(f(f(a.x*b.x)+f(a.y*b.y))+f(a.z*b.z));
const cross=(a:Vec3,b:Vec3):Vec3=>({x:f(f(a.y*b.z)-f(a.z*b.y)),y:f(f(a.z*b.x)-f(a.x*b.z)),z:f(f(a.x*b.y)-f(a.y*b.x))});
export interface WheelMotionInput {
  response:Pick<ReturnType<typeof nativeWheelResponse>,'forward'|'right'|'turnForward'|'turnRight'>;
  /** Orthonormal wheel basis, in world-aligned native Z-up axes. */
  forward:Vec3;right:Vec3;
  /** World-aligned offsets from the vehicle origin, NOT absolute positions. */
  point:Vec3;centerOfMass:Vec3;
  mass:number;turnMass:number;
}

/** Ordinary finite-mass vehicle branch of ProcessWheel/GetMass/ApplyTurnForce.
 * Outputs native linear/angular velocity increments, already timestep-scaled. */
export function nativeWheelVelocityDelta(input:WheelMotionInput){
  const forward=vector(input.forward),right=vector(input.right),point=vector(input.point),center=vector(input.centerOfMass);
  const mass=f(input.mass),turnMass=f(input.turnMass);requireAsset(mass>0&&turnMass>0,'Wheel motion requires positive mass and turn mass.');
  requireAsset(Math.abs(dot(forward,forward)-1)<1e-5&&Math.abs(dot(right,right)-1)<1e-5&&Math.abs(dot(forward,right))<1e-5,'Wheel motion requires an orthonormal contact basis.');
  const r=input.response,linear=add(scale(forward,f(r.forward)),scale(right,f(r.right)));
  const turn=add(scale(forward,f(r.turnForward)),scale(right,f(r.turnRight))),length=f(Math.sqrt(dot(turn,turn)));
  if(length===0)return {linear,angular:{x:0,y:0,z:0},effectiveTurnMass:mass};
  const direction=scale(turn,f(1/length)),lever=cross(point,direction);
  // GetMass uses the origin-relative point; ApplyTurnForce subtracts COM later.
  const effectiveTurnMass=f(1/f(f(dot(lever,lever)/turnMass)+f(1/mass)));
  const force=scale(direction,f(length*effectiveTurnMass)),arm=add(point,scale(center,-1));
  return {linear,angular:scale(cross(arm,force),f(1/turnMass)),effectiveTurnMass};
}

/** Native speed is distance/radians per 20 ms unit. Rx(-90°) maps native Z-up to
 * the browser's Y-up coordinates. Do not multiply the increment by dt again. */
function browserVelocity(v:Vec3):Vec3 {return {x:f(v.x*50),y:f(v.z*50),z:f(-v.y*50)};}

export function applyNativeWheelDelta(body:RAPIER.RigidBody,delta:ReturnType<typeof nativeWheelVelocityDelta>){
  applyNativeWheelDeltas(body,[delta]);
}

/** Validate and accumulate the whole wheel frame before either physical write. */
export function applyNativeWheelDeltas(body:RAPIER.RigidBody,deltas:readonly ReturnType<typeof nativeWheelVelocityDelta>[]){
  requireAsset(body.isDynamic(),'Native wheel motion requires a dynamic body.');
  if(deltas.length===0)return;
  let linear=vector(body.linvel()),angular=vector(body.angvel());
  for(const delta of deltas){
    linear=add(linear,browserVelocity(vector(delta.linear)));
    angular=add(angular,browserVelocity(vector(delta.angular)));
  }
  // Preserve the native scalar turn-mass model, not Rapier's inertia tensor.
  body.setLinvel(linear,true);body.setAngvel(angular,true);
}
