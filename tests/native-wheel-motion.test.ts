import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {nativeWheelVelocityDelta,applyNativeWheelDelta,type WheelMotionInput} from '../src/simulation/nativeWheelMotion';
const input:WheelMotionInput={response:{forward:.01,right:0,turnForward:.01,turnRight:0},forward:{x:0,y:1,z:0},right:{x:1,y:0,z:0},point:{x:1,y:0,z:0},centerOfMass:{x:0,y:0,z:0},mass:1000,turnMass:2000};
let world:RAPIER.World|undefined;
beforeAll(async()=>{await RAPIER.init();});afterEach(()=>{world?.free();world=undefined;});
function body(){world=new RAPIER.World({x:0,y:0,z:0});world.timestep=1/60;const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic());world.createCollider(RAPIER.ColliderDesc.cuboid(1,1,1).setMass(1000),body);return body;}
test('effective turning mass and center-of-mass lever use their distinct source points',()=>{
  const result=nativeWheelVelocityDelta(input);expect(result.effectiveTurnMass).toBeCloseTo(2000/3,3);expect(result.linear.y).toBeCloseTo(.01,7);expect(result.angular.z).toBeCloseTo(1/300,7);
  const offset=nativeWheelVelocityDelta({...input,centerOfMass:{x:.5,y:0,z:0}});expect(offset.effectiveTurnMass).toBe(result.effectiveTurnMass);expect(offset.angular.z).toBeCloseTo(result.angular.z/2,7);
  const centered=nativeWheelVelocityDelta({...input,point:{x:0,y:1,z:0}});expect(centered.effectiveTurnMass).toBeCloseTo(1000,3);expect(centered.angular).toEqual({x:0,y:0,z:0});
});
test('anti-dive may remove turning response while retaining linear response',()=>{
  const result=nativeWheelVelocityDelta({...input,response:{...input.response,turnForward:0}});expect(result.linear.y).toBeCloseTo(.01,7);expect(result.angular).toEqual({x:0,y:0,z:0});
});
test('real Rapier body receives one native-time conversion and advances at the resulting speed',()=>{
  const vehicle=body();vehicle.setLinvel({x:2,y:3,z:4},true);applyNativeWheelDelta(vehicle,nativeWheelVelocityDelta(input));
  expect(vehicle.linvel()).toEqual({x:2,y:3,z:3.5});expect(vehicle.angvel().y).toBeCloseTo(1/6,6);expect(vehicle.angvel().x).toBe(0);expect(vehicle.angvel().z).toBeCloseTo(0,7);
  world!.step();expect(vehicle.translation().z).toBeCloseTo(3.5/60,6);expect(vehicle.translation().x).toBeCloseTo(2/60,6);
});
test('symmetric wheel impulses add translation and cancel yaw on a real body',()=>{
  const vehicle=body();applyNativeWheelDelta(vehicle,nativeWheelVelocityDelta(input));
  applyNativeWheelDelta(vehicle,nativeWheelVelocityDelta({...input,point:{x:-1,y:0,z:0}}));
  expect(vehicle.linvel().z).toBeCloseTo(-1,6);expect(vehicle.angvel().y).toBeCloseTo(0,7);
});
test('rotated native contact basis maps both linear and axial directions consistently',()=>{
  const vehicle=body();const rotated={...input,forward:{x:1,y:0,z:0},right:{x:0,y:-1,z:0},point:{x:0,y:-1,z:0}};
  applyNativeWheelDelta(vehicle,nativeWheelVelocityDelta(rotated));expect(vehicle.linvel().x).toBeCloseTo(.5,6);expect(vehicle.linvel().z).toBeCloseTo(0,6);expect(vehicle.angvel().y).toBeCloseTo(1/6,6);
});
test('invalid basis, mass or angular output cannot partially change physical velocity',()=>{
  expect(()=>nativeWheelVelocityDelta({...input,turnMass:0})).toThrow(/mass/);
  expect(()=>nativeWheelVelocityDelta({...input,right:input.forward})).toThrow(/basis/);
  const vehicle=body();vehicle.setLinvel({x:1,y:2,z:3},true);
  expect(()=>applyNativeWheelDelta(vehicle,{linear:{x:1,y:0,z:0},angular:{x:NaN,y:0,z:0},effectiveTurnMass:1000})).toThrow();expect(vehicle.linvel()).toEqual({x:1,y:2,z:3});
  const fixed=world!.createRigidBody(RAPIER.RigidBodyDesc.fixed());expect(()=>applyNativeWheelDelta(fixed,nativeWheelVelocityDelta(input))).toThrow(/dynamic/);
});
