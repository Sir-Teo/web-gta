import type RAPIER from '@dimforge/rapier3d-compat';
import {WorldPlane} from './WorldPlane';
import {WorldCar} from './WorldCar';
import type {WorldBike} from './WorldBike';
import type {WorldBoat} from './WorldBoat';

/** The physical target used by DestroyCar, independent of whether the boarding host supports its seats. */
export type ScriptVehicleAttackTarget=Pick<WorldCar,'health'|'wrecked'|'disposed'|'boundRadius'|'damage'>&{car:{body:RAPIER.RigidBody}};
const targets=new WeakMap<object,ScriptVehicleAttackTarget>();
export function scriptVehicleAttackTarget(vehicle:WorldCar|WorldBike|WorldBoat|WorldPlane):ScriptVehicleAttackTarget{
 if(vehicle instanceof WorldCar)return vehicle;
 const previous=targets.get(vehicle);if(previous)return previous;
 const target:ScriptVehicleAttackTarget={
  car:{body:vehicle.body},
  get health(){return vehicle.health;},get wrecked(){return vehicle.wrecked;},get disposed(){return vehicle.disposed;},
  get boundRadius(){return vehicle.assets.collision!.bounds.radius;},
  damage(amount,collider,explosive=false,direction,options={}){
   const weapon=options.weapon??(explosive?51:options.kind==='fire'?37:options.kind==='melee'?0:22);
   if(vehicle instanceof WorldPlane)return vehicle.damage(amount,weapon,options.byPlayer,options.by);
   return vehicle.damage(amount,collider,explosive,direction,{kind:options.kind==='melee'?'melee':options.kind==='fire'?'fire':'bullet',weapon,byPlayer:options.byPlayer,by:options.by});
  },
 };
 targets.set(vehicle,target);return target;
}
/** DestroyCar::ControlSubTask (iOS 0x1003b8d50): a live reference with health not <= 0, independent of wrecked status.
 * The host stores doubles; round its health to the native float before comparison. NaN follows FCMP/B.LS too. */
export function destroyCarTargetActive(target:{health:number;disposed?:boolean}|undefined):target is {health:number;disposed?:boolean}{return !!target&&!target.disposed&&!(Math.fround(target.health)<=0);}
