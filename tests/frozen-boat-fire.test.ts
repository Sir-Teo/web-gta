import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Group} from 'three';
import {WorldBoat} from '../src/simulation/WorldBoat';
import {NativeClumpAlpha} from '../src/simulation/nativeClumpAlpha';
import {nativeAmbientState} from '../src/assets/nativeMaterial';
let world:RAPIER.World|undefined;beforeAll(async()=>{await RAPIER.init();});afterEach(()=>{world?.free();world=undefined;});
function setup(x=0,z=0){
 world=new RAPIER.World({x:0,y:-9.81,z:0});const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x,10,z)),collider=world.createCollider(RAPIER.ColliderDesc.cuboid(2,1,3),body),boat=Object.assign(Object.create(WorldBoat.prototype),{body,root:new Group(),sim:{player:{position:{x:0,y:0,z:0}}},clumpAlpha:new NativeClumpAlpha(()=>{}),ambient:nativeAmbientState(),frozen:true,occupied:false,wrecked:false,health:200,burnTimer:4.9,bombTimerMs:0,pendingExplosion:false}) as WorldBoat;
 return {world,body,collider,boat};
}
test('a frozen burning hull reaches the strict fire deadline, explodes and retains its held pose and collision',()=>{
 const {world,body,collider,boat}=setup(),position={...body.translation()};boat.beforeStep(.1);expect(boat.burnTimer).toBe(5);expect(boat.wrecked).toBe(false);boat.beforeStep(.05);expect(boat.wrecked).toBe(true);expect(boat.health).toBe(0);expect(boat.pendingExplosion).toBe(true);world.step();expect(body.translation()).toEqual(position);expect(collider.isEnabled()).toBe(true);expect(body.isEnabled()).toBe(true);
});
test('freezing retains the boat timer’s health hold/reset and strict camera-axis range gates',()=>{
 const {boat}=setup();boat.health=300;boat.burnTimer=3;boat.beforeStep(1);expect(boat.burnTimer).toBe(3);boat.health=500;boat.beforeStep(1);expect(boat.burnTimer).toBe(0);boat.health=200;boat.burnTimer=4.9;boat.body.setTranslation({x:200,y:10,z:0},true);boat.beforeStep(1);expect(boat.burnTimer).toBe(4.9);expect(boat.wrecked).toBe(false);
});
