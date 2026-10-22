import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Group} from 'three';
import {WorldPlane} from '../src/simulation/WorldPlane';
import {NativeClumpAlpha} from '../src/simulation/nativeClumpAlpha';

let world:RAPIER.World|undefined;
beforeAll(async()=>{await RAPIER.init();});afterEach(()=>{world?.free();world=undefined;});
const input={throttle:1,pitch:1,roll:1,rudder:1,brake:false};
function setup(modelId=487){
 world=new RAPIER.World({x:0,y:-9.81,z:0});const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,20,0)),collider=world.createCollider(RAPIER.ColliderDesc.cuboid(2,1,4),body);
 const heli=Object.assign(Object.create(WorldPlane.prototype),{modelId,assets:{vehicle:{type:'heli'}},body,root:new Group(),sim:{worldFocus:{x:0,y:20,z:0}},clumpAlpha:new NativeClumpAlpha(()=>{}),frozen:true,occupied:true,health:1000,drowning:false,recordingSlot:-1,rotorSpeed:0,propAngle:0,remoteGroundLoaded:()=>true}) as WorldPlane;
 return {world,body,collider,heli,angle:()=>Number((heli as any).propAngle)};
}
test('frozen controlled rotors spin up at their normal/RC rates without moving the solid hull',()=>{
 for(const [model,rate] of [[487,.001],[465,.003]]){
  const {world:physics,body,collider,heli,angle}=setup(model),position={...body.translation()},rotation={...body.rotation()};
  heli.beforeStep(1/30,input);expect(heli.rotorSpeed).toBeCloseTo(rate,8);expect(angle()).toBeGreaterThan(0);physics.step();expect(body.translation()).toEqual(position);expect(body.rotation()).toEqual(rotation);expect(collider.isEnabled()).toBe(true);physics.free();world=undefined;
 }
});
test('a stopped or submerged frozen helicopter winds its rotor down and stops at zero',()=>{
 const {heli,angle}=setup();heli.rotorSpeed=.1;heli.health=0;heli.beforeStep(1,input);expect(heli.rotorSpeed).toBeCloseTo(.0725,8);expect(angle()).toBeGreaterThan(0);heli.health=1000;heli.drowning=true;heli.beforeStep(10,input);expect(heli.rotorSpeed).toBe(0);const stopped=angle();heli.beforeStep(1,input);expect(angle()).toBe(stopped);
});
test('an AI helicopter retains its full-speed blades while frozen',()=>{
 const {heli,angle}=setup();heli.occupied=false;heli.autopilot={throttle:1,pitch:0,roll:0,rudder:0,brake:false};heli.beforeStep(1/30,input);expect(heli.rotorSpeed).toBe(.22);expect(angle()).toBeCloseTo(95/30,8);
});
