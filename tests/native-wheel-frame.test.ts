import {nativeWheelParameters} from '../src/simulation/nativeWheelParameters';
import {beforeAll,afterEach,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {readHandling} from '../src/assets/handling';
import {prepareHandling} from '../src/simulation/nativeHandling';
import {NATIVE_CAR_WHEELS,emptyWheelContacts} from '../src/simulation/nativeDriveContacts';
import {stepNativeWheelFrame,type NativeWheelFrameInput,type NativeWheelFrameState} from '../src/simulation/nativeWheelFrame';
import {sampleNativeWheelContact} from '../src/simulation/nativeWheelContact';
import {applyNativeWheelDeltas} from '../src/simulation/nativeWheelMotion';
const handling=()=>prepareHandling(readHandling('DIAGNOSTIC 1000 2000 0 0 0 0 75 .8 .9 .5 5 180 24 10 R P 8 .6 0 35 1.2 .15 .02 .3 -.2 .55 0 .25 .7 12345 0 0 1 2 3').records[0],0);
const state=():NativeWheelFrameState=>({drivetrain:{contacts:emptyWheelContacts(),transmission:{gear:1}},wheels:{frontLeft:'normal',frontRight:'normal',rearLeft:'normal',rearRight:'normal'}});
function frame():NativeWheelFrameInput {
  return {velocity:0,throttle:1,timeStep:1,compression:emptyWheelContacts(),engineEnabled:true,velocityFrequency:1,playerControlled:false,
    contacts:Object.fromEntries(NATIVE_CAR_WHEELS.map(w=>[w,{forward:{x:0,y:1,z:0},right:{x:1,y:0,z:0},point:{x:w.endsWith('Left')?-1:1,y:w.startsWith('front')?1:-1,z:-1},centerOfMass:{x:0,y:0,z:0},forwardSpeed:0,rightSpeed:0}])) as NativeWheelFrameInput['contacts'],
    parameters:Object.fromEntries(NATIVE_CAR_WHEELS.map(w=>[w,{brake:0,coastBrake:0,adhesion:1}])) as NativeWheelFrameInput['parameters']};
}
let world:RAPIER.World|undefined;beforeAll(async()=>{await RAPIER.init();});afterEach(()=>{world?.free();world=undefined;});
test('complete four-wheel chain uses a real raycast snapshot and drives the physical body',()=>{
  world=new RAPIER.World({x:0,y:0,z:0});world.createCollider(RAPIER.ColliderDesc.cuboid(10,.1,10));
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,1,0));world.createCollider(RAPIER.ColliderDesc.cuboid(.2,.2,.2).setMass(1000),body);
  const controller=world.createVehicleController(body);controller.indexUpAxis=1;controller.setIndexForwardAxis=2;
  for(const wheel of NATIVE_CAR_WHEELS){const i=controller.numWheels();controller.addWheel({x:wheel.endsWith('Left')?-1:1,y:0,z:wheel.startsWith('front')?-1:1},{x:0,y:-1,z:0},{x:-1,y:0,z:0},1,.2);controller.setWheelSuspensionStiffness(i,0);controller.setWheelMaxSuspensionForce(i,0);controller.setWheelFrictionSlip(i,0);controller.setWheelSideFrictionStiffness(i,0);}
  world.step();controller.updateVehicle(1/60,undefined,undefined,c=>c.parent()?.handle!==body.handle);
  const input=frame();for(const [i,wheel] of NATIVE_CAR_WHEELS.entries())input.contacts[wheel]=sampleNativeWheelContact(controller,i,{x:0,y:0,z:-1},0);
  const h=handling();
  input.parameters=nativeWheelParameters(h,{baseTraction:1,brakePedal:0,timeStep:1,coastBrake:0,compression:input.compression,
    surfaces:Object.fromEntries(NATIVE_CAR_WHEELS.map(w=>[w,{adhesiveLimit:1,wetMultiplier:1,offRoad:false,burst:false}])) as Parameters<typeof nativeWheelParameters>[1]['surfaces'],
    handbrake:false,burnout:false,tireTemperature:1,wheelDamageEffect:1,playerControlled:false,playerCollisions:false});
  const previous=state(),before=structuredClone(previous),result=stepNativeWheelFrame(h,previous,input,false);
  expect(result.contactCount).toBe(4);expect(result.driveContactCount).toBe(2);expect(result.motions).toHaveLength(2);expect(previous).toEqual(before);
  applyNativeWheelDeltas(body,result.motions);expect(body.linvel().z).toBeCloseTo(-.3072,6);expect(body.angvel().y).toBeCloseTo(0,7);
});
test('source rear-first flag changes shared-history ordering without resampling contacts',()=>{
  const h=handling(),previous=state(),input=frame();h.values.tractionLoss=.5;previous.wheels.frontLeft='spinning';input.engineEnabled=false;input.throttle=0;
  for(const w of NATIVE_CAR_WHEELS){input.contacts[w]!.rightSpeed=1;input.parameters[w].adhesion=.1;}
  const frontFirst=stepNativeWheelFrame(h,previous,input,false);h.values.handlingFlags=0x00800000;const rearFirst=stepNativeWheelFrame(h,previous,input,false);
  expect(frontFirst.order).toEqual(['frontLeft','frontRight','rearLeft','rearRight']);expect(rearFirst.order).toEqual(['rearLeft','rearRight','frontLeft','frontRight']);
  expect(Math.abs(frontFirst.responses.rearLeft!.right)).toBeCloseTo(.1,7);expect(Math.abs(rearFirst.responses.rearLeft!.right)).toBeCloseTo(.05,7);
});
test('reverse wheel-pair override clears spinning state after calculating the response',()=>{
  const previous=state(),input=frame();previous.drivetrain.transmission.gear=0;input.throttle=-1;input.velocity=-.02;
  for(const w of NATIVE_CAR_WHEELS){input.contacts[w]!.forwardSpeed=-.02;input.parameters[w].adhesion=.00001;}
  const result=stepNativeWheelFrame(handling(),previous,input,false);expect(result.responses.rearLeft!.state).toBe('spinning');expect(result.state.wheels.rearLeft).toBe('normal');
});
test('retained contacts require explicit fallback geometry and failure cannot commit frame state',()=>{
  const previous=state(),input=frame(),before=structuredClone(previous);input.contacts.rearRight=undefined;
  expect(()=>stepNativeWheelFrame(handling(),previous,input,false)).toThrow(/fallback contact/);expect(previous).toEqual(before);
  for(const w of NATIVE_CAR_WHEELS){input.compression[w]=1;input.contacts[w]=undefined;}
  expect(stepNativeWheelFrame(handling(),previous,input,false).motions).toEqual([]);
});
test('invalid later motion leaves both physical velocities unchanged and empty batches do not wake bodies',()=>{
  world=new RAPIER.World({x:0,y:0,z:0});const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic());world.createCollider(RAPIER.ColliderDesc.ball(1).setMass(1000),body);
  body.setLinvel({x:1,y:2,z:3},true);const good={linear:{x:1,y:0,z:0},angular:{x:0,y:0,z:0},effectiveTurnMass:1000};
  expect(()=>applyNativeWheelDeltas(body,[good,{...good,angular:{x:NaN,y:0,z:0}}])).toThrow();expect(body.linvel()).toEqual({x:1,y:2,z:3});expect(body.angvel()).toEqual({x:0,y:0,z:0});
  body.sleep();applyNativeWheelDeltas(body,[]);expect(body.isSleeping()).toBe(true);
});
