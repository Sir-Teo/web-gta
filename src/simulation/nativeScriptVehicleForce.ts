import type RAPIER from '@dimforge/rapier3d-compat';
import {nativeQuaternionBasis,type NativeVehicleBasis} from './nativeVehicleQuaternion';
import {requireAsset} from '../assets/binary';
type V={x:number;y:number;z:number};
export type ScriptVehicleForceBasis=NativeVehicleBasis;
const f=Math.fround,vec=(v:V):V=>({x:f(v.x),y:f(v.y),z:f(v.z)});
const cross=(a:V,b:V):V=>({x:f(f(a.y*b.z)-f(a.z*b.y)),y:f(f(a.z*b.x)-f(a.x*b.z)),z:f(f(a.x*b.y)-f(a.y*b.x))});
const length2=(v:V)=>f(f(f(v.x*v.x)+f(v.y*v.y))+f(v.z*v.z));
const transform=(b:NativeVehicleBasis,v:V):V=>{
 const axis=(key:keyof V)=>f(f(f(f(b.right[key])*v.x)+f(f(b.forward[key])*v.y))+f(f(b.up[key])*v.z));
 return{x:axis('x'),y:axis('y'),z:axis('z')};
};
export interface ScriptVehicleForceInput{mass:number;turnMass:number;centreOfMass:V;basis:NativeVehicleBasis;linear:V;angular:V;force:V;offset:V;flags?:number}
/** Complete APPLY_FORCE_TO_CAR valid-vehicle math: handler 0x1001fbc48 and CPhysical::ApplyForce 0x100248404.
 * Force/offset are world-aligned native axes, and the offset is relative to COM. Speeds use native units per frame. */
export function nativeScriptVehicleForce(input:ScriptVehicleForceInput){
 const force=vec(input.force),offset=vec(input.offset),centre=vec(input.centreOfMass),worldCom=transform(input.basis,centre),point={x:f(worldCom.x+offset.x),y:f(worldCom.y+offset.y),z:f(worldCom.z+offset.z)};
 const magnitude2=length2(force),inverse=magnitude2>0?f(1/f(Math.sqrt(magnitude2))):0,direction=magnitude2>0?{x:f(force.x*inverse),y:f(force.y*inverse),z:f(force.z*inverse)}:{...force,x:1};
 const lever={x:f(point.x-worldCom.x),y:f(point.y-worldCom.y),z:f(point.z-worldCom.z)},c=cross(lever,direction),mass=f(input.mass),turnMass=f(input.turnMass);
 const effectiveMass=f(1/f(f(1/mass)+f(length2(c)/turnMass))),scaled={x:f(force.x*effectiveMass),y:f(force.y*effectiveMass),z:f(force.z*effectiveMass)},flags=input.flags??0;
 let linear=vec(input.linear),angular=vec(input.angular);
 if(!(flags&0x60)){const inv=f(1/mass);linear={x:f(linear.x+f(scaled.x*inv)),y:f(linear.y+f(scaled.y*inv)),z:f(linear.z+f((flags&0x80?0:scaled.z)*inv))};}
 if(!(flags&0x10)){
  const infinite=!!(flags&0x40),tm=infinite?f(turnMass+f(centre.z*f(centre.z*f(mass*.5)))):turnMass,com=infinite?{x:0,y:0,z:0}:worldCom;
  const arm={x:f(point.x-com.x),y:f(point.y-com.y),z:f((flags&0x20?0:point.z)-com.z)},push={...scaled,z:flags&0x20?0:scaled.z},torque=cross(arm,push),inv=f(1/tm);
  angular={x:f(f(torque.x*inv)+angular.x),y:f(f(torque.y*inv)+angular.y),z:f(f(torque.z*inv)+angular.z)};
 }
 return{linear,angular,effectiveMass};
}
/** Bind the native impulse to the host body. Frozen position integration remains owned by syncFrozenVehicle. */
export function applyScriptVehicleForce(body:RAPIER.RigidBody,mass:number,turnMass:number,force:V,offset:V,basis?:NativeVehicleBasis){
 requireAsset([mass,turnMass,force.x,force.y,force.z,offset.x,offset.y,offset.z].every(Number.isFinite)&&mass>0&&turnMass>0,'Invalid script vehicle force.');
 const q=body.rotation(),com=body.localCom(),v=body.linvel(),w=body.angvel();
 const result=nativeScriptVehicleForce({mass,turnMass,force,offset,basis:basis??nativeQuaternionBasis({x:q.x,y:-q.z,z:q.y,w:q.w}),centreOfMass:{x:com.x,y:-com.z,z:com.y},linear:{x:v.x/50,y:-v.z/50,z:v.y/50},angular:{x:w.x/50,y:-w.z/50,z:w.y/50}});
 body.setLinvel({x:result.linear.x*50,y:result.linear.z*50,z:-result.linear.y*50},true);body.setAngvel({x:result.angular.x*50,y:result.angular.z*50,z:-result.angular.y*50},true);
 return result;
}
