import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {nativeSpringDamping,type NativeDampingInput} from '../src/simulation/nativeSpring';
import {applyNativeWheelDeltas} from '../src/simulation/nativeWheelMotion';
const input=():NativeDampingInput=>({direction:{x:0,y:0,z:-1},point:{x:0,y:0,z:-1},centerOfMass:{x:0,y:0,z:0},mass:1000,turnMass:2000,
  relativeSpeed:{x:0,y:0,z:-.02},currentSpeed:{x:0,y:0,z:-.02},damping:.5,springForceLimit:4,timeStep:1,makeMassTwiceAsBig:false,frameLimit:1,springLimitMultiplier:2});
let world:RAPIER.World|undefined;
beforeAll(async()=>{await RAPIER.init();});afterEach(()=>{world?.free();world=undefined;});
test('damping retains the one-sided spring-force cap',()=>{
  const down=nativeSpringDamping(input());expect(down.magnitude).toBeCloseTo(-10,5);expect(down.force.z).toBeCloseTo(10,5);
  const up=nativeSpringDamping({...input(),relativeSpeed:{x:0,y:0,z:.02},currentSpeed:{x:0,y:0,z:.02}});
  expect(up.magnitude).toBeCloseTo(8,5);expect(up.force.z).toBeCloseTo(-8,5);
});
test('saved relative speed and current chassis speed limit reversal in both directions',()=>{
  const i=input();
  expect(nativeSpringDamping({...i,currentSpeed:{x:0,y:0,z:-.003}}).dampingSpeed).toBeCloseTo(-.003,7);
  expect(nativeSpringDamping({...i,currentSpeed:{x:0,y:0,z:.003}}).dampingSpeed).toBe(0);
  i.relativeSpeed.z=.02;
  expect(nativeSpringDamping({...i,currentSpeed:{x:0,y:0,z:.003}}).dampingSpeed).toBeCloseTo(.003,7);
  expect(nativeSpringDamping({...i,currentSpeed:{x:0,y:0,z:-.003}}).dampingSpeed).toBe(0);
});
test('effective damping mass uses the COM-relative lever',()=>{
  const r=nativeSpringDamping({...input(),point:{x:2,y:0,z:-1},centerOfMass:{x:1,y:0,z:0}});
  expect(r.effectiveMass).toBeCloseTo(2000/3,3);expect(r.delta.angular.y).toBeCloseTo(-1/300,7);
});
test('timestep and special mass scaling precede the signed coefficient clamp',()=>{
  expect(nativeSpringDamping({...input(),timeStep:10,damping:.2,makeMassTwiceAsBig:true,frameLimit:.75}).coefficient).toBe(.75);
  expect(nativeSpringDamping({...input(),damping:-2,frameLimit:.75}).coefficient).toBe(-.75);
  expect(nativeSpringDamping({...input(),timeStep:0}).magnitude).toBeCloseTo(0,8);
});
test('a real falling chassis loses half its vertical speed from the diagnostic damping input',()=>{
  world=new RAPIER.World({x:0,y:0,z:0});const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic());world.createCollider(RAPIER.ColliderDesc.ball(.5).setMass(1000),body);
  body.setLinvel({x:0,y:-1,z:0},true);applyNativeWheelDeltas(body,[nativeSpringDamping(input()).delta]);
  expect(body.linvel().y).toBeCloseTo(-.5,6);expect(body.angvel()).toEqual({x:0,y:0,z:0});
});
test('invalid damping inputs leave caller data intact',()=>{
  const i=input(),before=structuredClone(i);nativeSpringDamping(i);expect(i).toEqual(before);
  for(const patch of [{frameLimit:-1},{mass:0},{springLimitMultiplier:NaN},{currentSpeed:{x:0,y:0,z:Infinity}}])expect(()=>nativeSpringDamping({...i,...patch})).toThrow();
});
