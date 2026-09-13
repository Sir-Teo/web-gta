import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {nativeSpringForce,nativeForceVelocityDelta,type NativeSpringInput} from '../src/simulation/nativeSpring';
import {applyNativeWheelDeltas} from '../src/simulation/nativeWheelMotion';
const input=():NativeSpringInput=>({compression:.5,forceLevel:1,bias:.5,mass:1000,timeStep:1,direction:{x:0,y:0,z:-1},normal:{x:0,y:0,z:1},mode:'normal',makeMassTwiceAsBig:false});
let world:RAPIER.World|undefined;
beforeAll(async()=>{await RAPIER.init();});afterEach(()=>{world?.free();world=undefined;});
test('source spring force scales compression, bias, mass and capped timestep',()=>{
  expect(nativeSpringForce(input()).dampingLimit).toBeCloseTo(4,6);
  expect(nativeSpringForce({...input(),compression:-.5}).dampingLimit).toBeCloseTo(12,5);
  expect(nativeSpringForce({...input(),timeStep:9}).dampingLimit).toBeCloseTo(12,5);
  expect(nativeSpringForce({...input(),compression:1}).force).toEqual({x:0,y:0,z:0});
  expect(nativeSpringForce({...input(),timeStep:0}).dampingLimit).toBe(0);
});
test('normal branch flips an inward normal and applies the special mass flag only there',()=>{
  const i={...input(),normal:{x:0,y:0,z:-1},makeMassTwiceAsBig:true},before=structuredClone(i);
  const result=nativeSpringForce(i);expect(result.normal.z).toBe(1);expect(result.force.z).toBeCloseTo(3,6);expect(i).toEqual(before);
  expect(nativeSpringForce({...i,mode:'direction'}).force.z).toBeCloseTo(4,6);
  expect(nativeSpringForce({...i,compression:1}).normal.z).toBe(-1);
});
test('force torque uses COM offset and is independent of tire effective-mass scaling',()=>{
  const delta=nativeForceVelocityDelta({force:{x:0,y:0,z:4},point:{x:2,y:0,z:-1},centerOfMass:{x:.5,y:0,z:0},mass:1000,turnMass:2000});
  expect(delta.linear.z).toBeCloseTo(.004,8);expect(delta.angular.y).toBeCloseTo(-.003,8);
});
test('four symmetric source springs lift a real body without introducing rotation',()=>{
  world=new RAPIER.World({x:0,y:0,z:0});const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic());
  world.createCollider(RAPIER.ColliderDesc.cuboid(1,.5,2).setMass(1000),body);
  const force=nativeSpringForce(input()).force;
  const deltas=[[-1,-2],[-1,2],[1,-2],[1,2]].map(([x,y])=>nativeForceVelocityDelta({force,point:{x,y,z:-1},centerOfMass:{x:0,y:0,z:0},mass:1000,turnMass:2000}));
  applyNativeWheelDeltas(body,deltas);expect(body.linvel().y).toBeCloseTo(.8,6);expect(Math.hypot(...Object.values(body.angvel()))).toBeCloseTo(0,7);
});
test('invalid force inputs reject rather than producing physical NaNs',()=>{
  expect(()=>nativeSpringForce({...input(),direction:{x:0,y:0,z:-2}})).toThrow(/unit/);
  expect(()=>nativeSpringForce({...input(),bias:2})).toThrow();
  expect(()=>nativeSpringForce({...input(),compression:NaN})).toThrow();
  expect(()=>nativeForceVelocityDelta({force:{x:0,y:0,z:1},point:{x:0,y:0,z:0},centerOfMass:{x:0,y:0,z:0},mass:0,turnMass:1})).toThrow();
});
