import {expect,test} from 'vitest';
import {readHandling} from '../src/assets/handling';
import {prepareHandling} from '../src/simulation/nativeHandling';
import {emptyWheelContacts,NATIVE_CAR_WHEELS} from '../src/simulation/nativeDriveContacts';
import {stepNativeResolvedWheelFrame,type NativeResolvedWheelFrameInput} from '../src/simulation/nativeResolvedWheelFrame';
import type {NativeWheelFrameState} from '../src/simulation/nativeWheelFrame';
const handling=()=>prepareHandling(readHandling('TEST 1000 2000 0 0 0 0 75 .8 .9 .5 5 180 24 10 R P 8 .6 0 35 1.2 .15 .02 .3 -.2 .55 0 .25 .7 12345 0 0 1 2 3').records[0],0);
const state=():NativeWheelFrameState=>({drivetrain:{contacts:emptyWheelContacts(),transmission:{gear:1}},wheels:{frontLeft:'normal',frontRight:'normal',rearLeft:'normal',rearRight:'normal'}});
function input():NativeResolvedWheelFrameInput{return {velocity:0,throttle:1,timeStep:1,compression:emptyWheelContacts(),engineEnabled:true,velocityFrequency:1,playerControlled:true,
  vehicleGrip:{physicsStatus:false,perfectHandling:false,extraPerfectHandling:false,extraHandlingNitros:false,isPlayerVehicle:true,vortex:false,vortexAccelerationBrakeStatus:0},
  contacts:Object.fromEntries(NATIVE_CAR_WHEELS.map(w=>[w,{forward:{x:0,y:1,z:0},right:{x:1,y:0,z:0},point:{x:0,y:0,z:-1},centerOfMass:{x:0,y:0,z:0},forwardSpeed:0,rightSpeed:0}])) as NativeResolvedWheelFrameInput['contacts'],
  wheelParameters:{brakePedal:0,coastBrake:0,handbrake:false,burnout:false,tireTemperature:1,wheelDamageEffect:1,playerCollisions:false,
    surfaces:Object.fromEntries(NATIVE_CAR_WHEELS.map(w=>[w,{adhesiveLimit:1,wetMultiplier:1,offRoad:false,burst:false}])) as NativeResolvedWheelFrameInput['wheelParameters']['surfaces']}};}
test('resolved source traction limits tire response rather than using arbitrary high adhesion',()=>{
  const r=stepNativeResolvedWheelFrame(handling(),state(),input(),false);
  expect(r.traction).toBeCloseTo(.0008,9);expect(r.parameters.rearLeft.adhesion).toBeCloseTo(.0008,9);
  expect(r.acceleration).toBeCloseTo(.003072,8);expect(r.responses.rearLeft!.state).toBe('spinning');
  expect(r.responses.rearLeft!.forward).toBeCloseTo(.000576,9);expect(r.cheat).toBe('none');
});
test('one context supplies perfect grip and transmission while NOS retains precedence',()=>{
  const i=input();i.vehicleGrip.perfectHandling=true;
  const r=stepNativeResolvedWheelFrame(handling(),state(),i,false);expect(r.cheat).toBe('perfect');expect(r.traction).toBeCloseTo(.0032,9);
  const h=handling();h.values.handlingFlags=0x80000;i.wheelParameters.tireTemperature=-1;
  const nos=stepNativeResolvedWheelFrame(h,state(),i,false);expect(nos.cheat).toBe('nitros');expect(nos.traction).toBeCloseTo(.0032,9);
  expect(nos.parameters.rearLeft.adhesion).toBeCloseTo(.0032,9);expect(nos.acceleration).toBeCloseTo(.006144,8);
});
test('wet and damage inputs scale the shared traction path and failures preserve state',()=>{
  const i=input(),previous=state();i.wheelParameters.surfaces.rearLeft.burst=true;i.wheelParameters.surfaces.rearLeft.burstNoise=0;i.wheelParameters.wheelDamageEffect=.5;
  const r=stepNativeResolvedWheelFrame(handling(),previous,i,false);expect(r.parameters.rearLeft.adhesion).toBeCloseTo(.0004,9);
  i.wheelParameters.playerCollisions=true;i.compression.rearLeft=.75;i.wheelParameters.surfaces.rearLeft.wetMultiplier=.5;
  expect(stepNativeResolvedWheelFrame(handling(),previous,i,false).parameters.rearLeft.adhesion).toBeCloseTo(.000216,9);
  const before=structuredClone(previous);i.vehicleGrip.physicsStatus=true;
  expect(()=>stepNativeResolvedWheelFrame(handling(),previous,i,false)).toThrow(/car traction/);expect(previous).toEqual(before);
});
