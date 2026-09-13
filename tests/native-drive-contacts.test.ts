import {expect,test} from 'vitest';
import {readHandling} from '../src/assets/handling';
import {prepareHandling} from '../src/simulation/nativeHandling';
import {emptyWheelContacts,stepDriveContacts,stepNativeDrivetrain,type WheelValues} from '../src/simulation/nativeDriveContacts';
const air:WheelValues={frontLeft:1,rearLeft:1,frontRight:1,rearRight:1},ground=emptyWheelContacts();
const handling=(drive='R')=>prepareHandling(readHandling(`DIAGNOSTIC 1200 2400 0 0 0 0 75 .8 .9 .5 5 180 24 10 ${drive} P 8 .6 0 35 1.2 .15 .02 .3 -.2 .55 .1 .25 .7 12345 0 0 1 2 3`).records[0],0);
const input={velocity:0,throttle:1,timeStep:1,compression:ground,engineEnabled:true,velocityFrequency:1};
test('one driven contact suffices and explicit wheel names select the correct axle',()=>{
  for(const drive of ['F','R','4']){
    const result=stepDriveContacts(emptyWheelContacts(),{...air,frontRight:.999},drive,1);
    expect(result.count).toBe(1);expect(result.driveCount).toBe(drive==='R'?0:1);expect(result.counters.frontRight).toBe(4);
  }
  expect(stepDriveContacts(emptyWheelContacts(),{...air,rearLeft:0},'R',1).driveCount).toBe(1);
});
test('contact retention decrements before counting and refreshes only below compression one',()=>{
  let state=stepDriveContacts(emptyWheelContacts(),ground,'4',1);expect(state.count).toBe(4);
  for(const remaining of [3,2,1,0]){state=stepDriveContacts(state.counters,air,'4',1);expect(state.counters.frontLeft).toBe(remaining);expect(state.count).toBe(remaining?4:0);}
  const previous={...emptyWheelContacts(),frontLeft:.5};expect(stepDriveContacts(previous,air,'F',.5).count).toBe(0);
  expect(stepDriveContacts(previous,air,'F',0).counters.frontLeft).toBe(.5);
  expect(stepDriveContacts(previous,{...air,frontLeft:.9},'F',3).counters.frontLeft).toBe(4);expect(previous.frontLeft).toBe(.5);
});
test('drivetrain uses any retained drive contact for inertia, then switches to airborne state on expiry',()=>{
  const h=handling(),prior={contacts:emptyWheelContacts(),transmission:{gear:1,inertia:{ratio:0,smoothing:1}}};
  const one=stepNativeDrivetrain(h,prior,{...input,compression:{...air,rearLeft:0}});
  expect(one.driveContactCount).toBe(1);expect(one.state.transmission.inertia!.smoothing).toBeCloseTo(.865,6);expect(one.thrust.rearLeft).toBeGreaterThan(0);expect(one.thrust.rearRight).toBe(0);
  const retained=stepNativeDrivetrain(h,one.state,{...input,compression:air,timeStep:3});expect(retained.driveContactCount).toBe(1);
  const expired=stepNativeDrivetrain(h,retained.state,{...input,compression:air});expect(expired.driveContactCount).toBe(0);expect(expired.state.transmission.inertia!.smoothing).toBe(Math.fround(.1));expect(expired.thrust).toEqual(emptyWheelContacts());
  expect(prior.contacts).toEqual(emptyWheelContacts());expect(prior.transmission.inertia.smoothing).toBe(1);
});
test('per-wheel thrust follows the drive layout without a second wheel-count division',()=>{
  const prior={contacts:emptyWheelContacts(),transmission:{gear:1}};
  const rear=stepNativeDrivetrain(handling('R'),prior,input),front=stepNativeDrivetrain(handling('F'),prior,input),four=stepNativeDrivetrain(handling('4'),prior,input);
  expect(rear.thrust.frontLeft).toBe(0);expect(rear.thrust.rearLeft).toBeCloseTo(.003072,8);
  expect(front.thrust.rearLeft).toBe(0);expect(front.thrust.frontRight).toBe(rear.thrust.rearRight);
  expect(Object.values(four.thrust).reduce((a,b)=>a+b,0)).toBeCloseTo(Object.values(rear.thrust).reduce((a,b)=>a+b,0),8);
  expect(stepNativeDrivetrain(handling(),prior,{...input,velocityFrequency:2}).thrust.rearLeft).toBeCloseTo(rear.thrust.rearLeft/2,8);
});
test('disabled engine preserves transmission while contact history updates, and invalid inputs do not commit',()=>{
  const h=handling(),prior={contacts:emptyWheelContacts(),transmission:{gear:1,inertia:{ratio:.2,smoothing:.7}}},before=structuredClone(prior);
  const stopped=stepNativeDrivetrain(h,prior,{...input,engineEnabled:false});expect(stopped.thrust).toEqual(emptyWheelContacts());expect(stopped.state.transmission).toEqual(prior.transmission);expect(stopped.contactCount).toBe(4);
  for(const bad of [{velocityFrequency:0},{timeStep:4},{compression:{...ground,rearRight:NaN}}])expect(()=>stepNativeDrivetrain(h,prior,{...input,...bad})).toThrow();
  expect(prior).toEqual(before);
});
