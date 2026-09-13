import {expect,test} from 'vitest';
import {readHandling} from '../src/assets/handling';
import {prepareHandling} from '../src/simulation/nativeHandling';
import {emptyWheelContacts,NATIVE_CAR_WHEELS} from '../src/simulation/nativeDriveContacts';
import {initialNativeVehicleState} from '../src/simulation/nativeVehicleState';
import {stepNativeSuspendedWheelFrame,type NativeSuspendedWheelInput} from '../src/simulation/nativeSuspendedWheelFrame';
const handling=()=>prepareHandling(readHandling('TEST 1000 2000 0 0 0 0 75 .8 .9 .5 5 180 24 10 R P 8 .6 0 35 1.2 .15 .02 .3 -.2 .55 0 .25 .7 12345 0 0 1 2 3').records[0],0);
function input():NativeSuspendedWheelInput{return {
  suspension:{linear:{x:0,y:0,z:0},angular:{x:0,y:0,z:0},centerOfMass:{x:0,y:0,z:0},mass:1000,turnMass:2000,direction:{x:0,y:0,z:-1},timeStep:1,mode:'normal',makeMassTwiceAsBig:false,frameLimit:1,springLimitMultiplier:2,wheels:{frontLeft:{compression:.5,point:{x:1,y:0,z:-1},normal:{x:0,y:0,z:1},groundSpeed:{x:0,y:0,z:0},forceLevel:1,bias:.5,damping:0},rearLeft:undefined,frontRight:undefined,rearRight:undefined}},
  tires:{velocity:0,throttle:0,timeStep:1,compression:{frontLeft:.5,rearLeft:1,frontRight:1,rearRight:1},engineEnabled:false,velocityFrequency:1,playerControlled:true,
    vehicleGrip:{physicsStatus:false,perfectHandling:false,extraPerfectHandling:false,extraHandlingNitros:false,isPlayerVehicle:true,vortex:false,vortexAccelerationBrakeStatus:0},
    wheelParameters:{brakePedal:0,coastBrake:0,handbrake:false,burnout:false,tireTemperature:1,wheelDamageEffect:1,playerCollisions:false,surfaces:Object.fromEntries(NATIVE_CAR_WHEELS.map(w=>[w,{adhesiveLimit:1,wetMultiplier:1,offRoad:false,burst:false}])) as NativeSuspendedWheelInput['tires']['wheelParameters']['surfaces']}},forward:{x:0,y:1,z:0},steering:emptyWheelContacts(),fallback:{}};}
test('tire contact speeds include spring-induced chassis rotation',()=>{
  const r=stepNativeSuspendedWheelFrame(handling(),initialNativeVehicleState().wheelFrame,input(),false);
  expect(r.contacts.frontLeft!.rightSpeed).toBeCloseTo(.002,7);expect(r.tires.responses.frontLeft!.right).toBeLessThan(0);
  expect(r.motions.length).toBe(r.suspension.motions.length+r.tires.motions.length);
});
test('post-suspension sampling subtracts ground velocity and uses flipped normals',()=>{
  const i=input();i.suspension.wheels.frontLeft!.normal.z=-1;i.suspension.wheels.frontLeft!.groundSpeed.x=.001;
  const r=stepNativeSuspendedWheelFrame(handling(),initialNativeVehicleState().wheelFrame,i,false);
  expect(r.contacts.frontLeft!.rightSpeed).toBeCloseTo(.001,7);expect(r.suspension.springs.frontLeft!.normal.z).toBe(1);
});
test('retained airborne tires require explicit fallback while suspension applies no spring there',()=>{
  const i=input(),previous=initialNativeVehicleState().wheelFrame;previous.drivetrain.contacts.rearLeft=4;
  expect(()=>stepNativeSuspendedWheelFrame(handling(),previous,i,false)).toThrow(/fallback/);
  i.fallback.rearLeft={point:{x:0,y:-1,z:-1},normal:{x:0,y:0,z:1},groundSpeed:{x:0,y:0,z:0}};
  const r=stepNativeSuspendedWheelFrame(handling(),previous,i,false);expect(r.suspension.springs.rearLeft).toBeUndefined();expect(r.state.drivetrain.contacts.rearLeft).toBe(3);
});
test('inconsistent physical inputs fail without mutating previous state',()=>{
  const i=input(),previous=initialNativeVehicleState().wheelFrame,before=structuredClone(previous);i.tires.compression.frontLeft=.6;
  expect(()=>stepNativeSuspendedWheelFrame(handling(),previous,i,false)).toThrow(/disagrees/);expect(previous).toEqual(before);
});
