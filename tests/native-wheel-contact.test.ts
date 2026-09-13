import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {nativeContactBasis,sampleNativeWheelContact} from '../src/simulation/nativeWheelContact';
import {nativeWheelResponse} from '../src/simulation/nativeWheelResponse';
import {nativeWheelVelocityDelta,applyNativeWheelDelta} from '../src/simulation/nativeWheelMotion';
let world:RAPIER.World|undefined;
beforeAll(async()=>{await RAPIER.init();});afterEach(()=>{world?.free();world=undefined;});
function setup(centerX=0){
  world=new RAPIER.World({x:0,y:0,z:0});const platform=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicVelocityBased());
  const floor=world.createCollider(RAPIER.ColliderDesc.cuboid(10,.1,10),platform);
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,1,0));world.createCollider(RAPIER.ColliderDesc.cuboid(.2,.2,.2).setTranslation(centerX,0,0).setMass(1000),body);
  const controller=world.createVehicleController(body);controller.indexUpAxis=1;controller.setIndexForwardAxis=2;
  controller.addWheel({x:1,y:0,z:0},{x:0,y:-1,z:0},{x:-1,y:0,z:0},1,.2);
  controller.setWheelSuspensionStiffness(0,0);controller.setWheelMaxSuspensionForce(0,0);controller.setWheelFrictionSlip(0,0);controller.setWheelSideFrictionStiffness(0,0);
  world.step();
  const refresh=()=>controller.updateVehicle(1/60,undefined,undefined,c=>c.parent()?.handle!==body.handle);
  return {body,platform,floor,controller,refresh};
}
test('road projection and native steering produce a tangent orthonormal basis',()=>{
  const c=Math.SQRT1_2,basis=nativeContactBasis({x:0,y:1,z:0},{x:0,y:c,z:c},0)!;
  expect(basis.forward.y).toBeCloseTo(c,6);expect(basis.forward.z).toBeCloseTo(-c,6);expect(basis.right.x).toBeCloseTo(1,6);
  const turned=nativeContactBasis({x:0,y:1,z:0},{x:0,y:0,z:1},Math.PI/2)!;expect(turned.forward.x).toBeCloseTo(-1,6);expect(turned.right.y).toBeCloseTo(1,6);
  expect(nativeContactBasis({x:0,y:0,z:1},{x:0,y:0,z:1},0)).toBeUndefined();
  expect(()=>nativeContactBasis({x:0,y:2,z:0},{x:0,y:0,z:1},0)).toThrow(/unit/);
});
test('real contact subtracts moving and rotating ground velocity at the hit point',()=>{
  const {body,platform,floor,controller,refresh}=setup();body.setLinvel({x:0,y:0,z:10},true);body.setAngvel({x:0,y:1,z:0},true);
  platform.setLinvel({x:0,y:0,z:2},true);platform.setAngvel({x:0,y:.5,z:0},true);refresh();
  const sample=sampleNativeWheelContact(controller,0,{x:0,y:0,z:1},0)!;
  expect(sample.groundCollider).toBe(floor.handle);expect(sample.point.x).toBeCloseTo(1,6);expect(sample.point.z).toBeCloseTo(-.9,6);
  expect(sample.forwardSpeed).toBeCloseTo(.15,6);expect(sample.rightSpeed).toBeCloseTo(0,6);expect(sample.relativeVelocity.y).toBeCloseTo(-.15,6);
});
test('center-of-mass offset is retained and influences the sampled rotational contact speed',()=>{
  const {body,platform,controller,refresh}=setup(.5);body.setLinvel({x:0,y:0,z:10},true);body.setAngvel({x:0,y:1,z:0},true);
  platform.setLinvel({x:0,y:0,z:2},true);platform.setAngvel({x:0,y:.5,z:0},true);refresh();
  const sample=sampleNativeWheelContact(controller,0,{x:0,y:0,z:1},0)!;expect(sample.centerOfMass.x).toBeCloseTo(.5,6);expect(sample.forwardSpeed).toBeCloseTo(.16,6);
});
test('sampled contact feeds tire braking and native motion back into the real body',()=>{
  const {body,controller,refresh}=setup();body.setLinvel({x:0,y:0,z:10},true);refresh();
  const sample=sampleNativeWheelContact(controller,0,{x:0,y:0,z:1},0)!;
  const response=nativeWheelResponse({wheel:'frontRight',previousState:'normal',alreadySkidding:false,forwardSpeed:sample.forwardSpeed,rightSpeed:sample.rightSpeed,contactCount:1,thrust:0,brake:.01,coastBrake:0,adhesion:1,tractionLoss:1,throttle:0,timeStep:1,playerControlled:true,antiDive:0});
  applyNativeWheelDelta(body,nativeWheelVelocityDelta({...sample,response,mass:1000,turnMass:2000}));
  expect(body.linvel().z).toBeCloseTo(9.5,6);expect(Math.abs(body.angvel().y)).toBeGreaterThan(0);
});
test('missing contact and degenerate basis skip response while invalid indices reject',()=>{
  const {body,controller,refresh}=setup();refresh();expect(sampleNativeWheelContact(controller,0,{x:0,y:1,z:0},0)).toBeUndefined();
  body.setTranslation({x:0,y:10,z:0},true);world!.step();refresh();expect(sampleNativeWheelContact(controller,0,{x:0,y:0,z:1},0)).toBeUndefined();
  expect(()=>sampleNativeWheelContact(controller,1,{x:0,y:0,z:1},0)).toThrow(/index/);
});
test('geometric contact retains native ground velocity without requiring a tangent basis',async()=>{
  const {sampleNativeWheelGeometry}=await import('../src/simulation/nativeWheelContact');
  const {platform,controller,refresh}=setup();platform.setLinvel({x:0,y:0,z:2},true);platform.setAngvel({x:0,y:.5,z:0},true);refresh();
  const sample=sampleNativeWheelGeometry(controller,0)!;
  expect(sample.normal).toEqual({x:0,y:-0,z:1});expect(sample.groundSpeed.y).toBeCloseTo(-.03,6);
  expect(sampleNativeWheelContact(controller,0,{x:0,y:1,z:0},0)).toBeUndefined();
});
