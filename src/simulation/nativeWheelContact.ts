import type RAPIER from '@dimforge/rapier3d-compat';
import type {Vec3} from '../core/math';
import {requireAsset} from '../assets/binary';
import type {NativeCollisionSource} from './nativeCollision';
import {sampleNativeWheelSurface} from './nativeWheelSurface';

const f=(n:number)=>{const value=Math.fround(n);requireAsset(Number.isFinite(value),'Nonfinite wheel contact.');return value;};
const vector=(v:Vec3):Vec3=>({x:f(v.x),y:f(v.y),z:f(v.z)});
const scale=(v:Vec3,n:number):Vec3=>({x:f(v.x*n),y:f(v.y*n),z:f(v.z*n)});
const add=(a:Vec3,b:Vec3):Vec3=>({x:f(a.x+b.x),y:f(a.y+b.y),z:f(a.z+b.z)});
const sub=(a:Vec3,b:Vec3)=>add(a,scale(b,-1));
const dot=(a:Vec3,b:Vec3)=>f(f(f(a.x*b.x)+f(a.y*b.y))+f(a.z*b.z));
const cross=(a:Vec3,b:Vec3):Vec3=>({x:f(f(a.y*b.z)-f(a.z*b.y)),y:f(f(a.z*b.x)-f(a.x*b.z)),z:f(f(a.x*b.y)-f(a.y*b.x))});
const native=(v:Vec3):Vec3=>({x:f(v.x),y:f(-v.z),z:f(v.y)});
function normalized(v:Vec3){const length=f(Math.sqrt(dot(v,v)));return length>1e-6?scale(v,f(1/length)):undefined;}

/** Source wheel-pair projection and steering, in native Z-up coordinates.
 * A degenerate forward projection yields no usable basis, never NaN thrust. */
export function nativeContactBasis(forward:Vec3,normal:Vec3,steerAngle:number){
  forward=vector(forward);normal=vector(normal);steerAngle=f(steerAngle);
  requireAsset(Math.abs(dot(forward,forward)-1)<1e-5&&Math.abs(dot(normal,normal)-1)<1e-5,'Wheel basis requires unit forward and surface normal.');
  const projected=normalized(sub(forward,scale(normal,dot(forward,normal))));if(!projected)return;
  const right=normalized(cross(projected,normal));if(!right)return;
  const cosine=f(Math.cos(steerAngle)),sine=f(Math.sin(steerAngle));
  return {forward:sub(scale(projected,cosine),scale(right,sine)),right:add(scale(projected,sine),scale(right,cosine)),normal};
}

/** Read after Rapier has refreshed wheel raycasts. Samples all motion at the hit
 * point; caller must collect every wheel before applying any new tire response.
 * The supplied forward/steer convention belongs to the native vehicle adapter. */
export function sampleNativeWheelContact(controller:RAPIER.DynamicRayCastVehicleController,index:number,forwardWorld:Vec3,steerAngle:number,sources?:ReadonlyMap<number,NativeCollisionSource>){
  requireAsset(Number.isInteger(index)&&index>=0&&index<controller.numWheels(),'Invalid wheel contact index.');
  if(!controller.wheelIsInContact(index))return;
  const point=controller.wheelContactPoint(index),normal=controller.wheelContactNormal(index),ground=controller.wheelGroundObject(index);
  requireAsset(point&&normal&&ground,'Contacting wheel is missing raycast data.');
  const basis=nativeContactBasis(native(forwardWorld),native(normal),steerAngle);if(!basis)return;
  const body=controller.chassis(),surfaceBody=ground.parent();
  const speed=body.velocityAtPoint(point),groundSpeed=surfaceBody?.velocityAtPoint(point)??{x:0,y:0,z:0};
  const relativeVelocity=scale(native(sub(speed,groundSpeed)),f(1/50));
  return {...basis,point:native(sub(point,body.translation())),centerOfMass:native(sub(body.worldCom(),body.translation())),
    relativeVelocity,forwardSpeed:dot(relativeVelocity,basis.forward),rightSpeed:dot(relativeVelocity,basis.right),
    groundCollider:ground.handle,surface:sources?sampleNativeWheelSurface(controller,index,sources):undefined,suspensionLength:controller.wheelSuspensionLength(index)};
}
