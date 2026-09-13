import {expect,test} from 'vitest';
import {initialNativeVehicleState} from '../src/simulation/nativeVehicleState';
import {readHandling} from '../src/assets/handling';
import {prepareHandling} from '../src/simulation/nativeHandling';
import {emptyWheelContacts,stepNativeDrivetrain} from '../src/simulation/nativeDriveContacts';
test('fresh mechanical state reflects all three source constructors without shared records',()=>{
  const a=initialNativeVehicleState(),b=initialNativeVehicleState();
  expect(a.wheelFrame.drivetrain.transmission).toEqual({gear:1,inertia:{ratio:0,smoothing:0}});
  expect([a.velocityFrequency,a.carTraction,a.tireTemperature]).toEqual([1,1,1]);
  expect(Object.values(a.compression)).toEqual([1,1,1,1]);expect(Object.values(a.wheelFrame.drivetrain.contacts)).toEqual([0,0,0,0]);
  a.compression.frontLeft=.2;a.wheelFrame.drivetrain.transmission.inertia!.smoothing=.8;a.rotation.frontLeft=1;
  expect(a.previousCompression.frontLeft).toBe(1);expect(b.compression.frontLeft).toBe(1);
  expect(b.wheelFrame.drivetrain.transmission.inertia!.smoothing).toBe(0);expect(a.wheelSpeed.frontLeft).toBe(0);
});
test('first grounded drivetrain update consumes initialized inertia instead of bypassing it',()=>{
  const h=prepareHandling(readHandling('TEST 1000 2000 0 0 0 0 75 .8 .9 .5 5 180 24 10 R P 8 .6 0 35 1.2 .15 .02 .3 -.2 .55 0 .25 .7 12345 0 0 1 2 3').records[0],0);
  const fresh=initialNativeVehicleState(),input={velocity:0,throttle:1,timeStep:1,compression:emptyWheelContacts(),engineEnabled:true,velocityFrequency:fresh.velocityFrequency};
  const initialized=stepNativeDrivetrain(h,fresh.wheelFrame.drivetrain,input);
  const diagnostic=stepNativeDrivetrain(h,{contacts:emptyWheelContacts(),transmission:{gear:1}},input);
  expect(initialized.acceleration).toBeLessThan(diagnostic.acceleration);
  expect(initialized.acceleration).toBeCloseTo(diagnostic.acceleration*initialized.state.transmission.inertia!.smoothing,9);
  expect(fresh.wheelFrame.drivetrain.transmission.inertia!.smoothing).toBe(0);
});
