import {expect,test} from 'vitest';
import {readHandling} from '../src/assets/handling';
import {prepareHandling} from '../src/simulation/nativeHandling';
import {NATIVE_CAR_WHEELS} from '../src/simulation/nativeDriveContacts';
import {nativeWheelParameters,type WheelParameterInput} from '../src/simulation/nativeWheelParameters';
const handling=()=>prepareHandling(readHandling('DIAGNOSTIC 1000 2000 0 0 0 0 75 .8 .9 .6 5 180 24 10 R P 8 .7 0 35 1 .15 .02 .3 -.2 .4 0 .25 .7 12345 0 0 1 2 3').records[0],0);
function input():WheelParameterInput{return {baseTraction:2,brakePedal:.5,timeStep:2,coastBrake:.03,handbrake:false,burnout:false,tireTemperature:1,wheelDamageEffect:.25,playerControlled:true,playerCollisions:false,
  compression:{frontLeft:.75,frontRight:.75,rearLeft:.75,rearRight:.75},surfaces:Object.fromEntries(NATIVE_CAR_WHEELS.map(w=>[w,{adhesiveLimit:1,wetMultiplier:.5,offRoad:false,burst:false}])) as WheelParameterInput['surfaces']};}
test('native brake timestep and axle bias resolve independently of drive layout',()=>{
  const p=nativeWheelParameters(handling(),input());expect(p.frontLeft.brake).toBeCloseTo(.00448,7);expect(p.rearLeft.brake).toBeCloseTo(.00192,7);
  expect(p.frontLeft.adhesion).toBeCloseTo(2.4,6);expect(p.rearLeft.adhesion).toBeCloseTo(1.6,6);expect(p.frontRight).toEqual(p.frontLeft);expect(p.rearRight).toEqual(p.rearLeft);
});
test('player collision rules apply wetness and axle suspension load, capped at two',()=>{
  const h=handling(),i=input();i.playerCollisions=true;
  const p=nativeWheelParameters(h,i);expect(p.frontLeft.adhesion).toBeCloseTo(.96,6);expect(p.rearLeft.adhesion).toBeCloseTo(.96,6);
  i.compression.frontLeft=0;expect(nativeWheelParameters(h,i).frontLeft.adhesion).toBeCloseTo(2.4,6);
  i.compression.frontLeft=1;expect(nativeWheelParameters(h,i).frontLeft.adhesion).toBe(0);
});
test('neutral NPC bias leaves suspension load asymmetric and does not affect player bias',()=>{
  const h=handling(),i=input();h.values.handlingFlags=8;i.playerControlled=false;i.playerCollisions=true;
  const p=nativeWheelParameters(h,i);expect(p.frontLeft.brake).toBeCloseTo(.0032,7);expect(p.rearLeft.brake).toBeCloseTo(.0032,7);expect(p.frontLeft.adhesion).toBeCloseTo(.8,6);expect(p.rearLeft.adhesion).toBeCloseTo(1.2,6);
  i.playerControlled=true;expect(nativeWheelParameters(h,i).frontLeft.brake).toBeCloseTo(.00448,7);
});
test('off-road upgrade priority and burst damage apply after wet/load scaling',()=>{
  const h=handling(),i=input();h.values.tractionBias=.5;h.values.suspensionBias=.5;i.playerCollisions=true;i.surfaces.frontLeft.offRoad=true;
  h.values.handlingFlags=0x100000;expect(nativeWheelParameters(h,i).frontLeft.adhesion).toBeCloseTo(1.15,6);
  h.values.handlingFlags=0x300000;i.surfaces.frontLeft.burst=true;i.surfaces.frontLeft.burstNoise=.12;const p=nativeWheelParameters(h,i);expect(p.frontLeft.adhesion).toBeCloseTo(.35,6);expect(p.frontLeft.burstNoise).toBe(.12);
  i.playerCollisions=false;expect(nativeWheelParameters(h,i).frontLeft.adhesion).toBeCloseTo(.5,6);
});
test('rear handbrake, rear-wheel steering and NOS preserve tire-temperature branch precedence',()=>{
  const h=handling(),i=input();i.tireTemperature=10;expect(nativeWheelParameters(h,i).rearLeft.adhesion).toBeCloseTo(16,5);
  i.handbrake=true;let p=nativeWheelParameters(h,i);expect(p.rearLeft.brake).toBeCloseTo(12000,2);expect(p.rearLeft.adhesion).toBeCloseTo(1.6,6);
  h.values.handlingFlags=0x40;p=nativeWheelParameters(h,i);expect(p.rearLeft.brake).toBeCloseTo(.00192,7);expect(p.rearLeft.adhesion).toBeCloseTo(16,5);
  i.handbrake=false;h.values.handlingFlags=0x80000;i.tireTemperature=-1;expect(nativeWheelParameters(h,i).rearLeft.adhesion).toBeCloseTo(1.6,6);
});
test('burnout requiring a separate force rejects and malformed inputs leave callers intact',()=>{
  const h=handling(),i=input(),before=structuredClone(i);nativeWheelParameters(h,i);expect(i).toEqual(before);i.burnout=true;expect(()=>nativeWheelParameters(h,i)).toThrow(/turning-force/);
  i.handbrake=true;expect(nativeWheelParameters(h,i).rearLeft.brake).toBeGreaterThan(10000);
  h.values.driveType='F';i.handbrake=false;expect(()=>nativeWheelParameters(h,i)).not.toThrow();
  for(const invalid of [{brakePedal:2},{timeStep:4},{baseTraction:NaN},{compression:{...before.compression,frontLeft:1.1}}])expect(()=>nativeWheelParameters(handling(),{...before,...invalid})).toThrow();
});
