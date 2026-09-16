import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {CarEntry} from '../src/simulation/CarEntry';
import {VehicleAnimationLibrary} from '../src/assets/vehicleAnimations';
import {rollDoorLock} from '../src/assets/worldCarGenerators';
import {CAR_ALARM_SECONDS,tickAlarm,type WorldCar} from '../src/simulation/WorldCar';
import {worldCarAudioInput} from '../src/audio/native/worldVehicleAudio';

beforeAll(async()=>{await RAPIER.init();});

test('door locks roll the generator percentage',()=>{
  expect(rollDoorLock(0,()=>0)).toBe(false);
  expect(rollDoorLock(0,()=>.999)).toBe(false);
  expect(rollDoorLock(100,()=>.999)).toBe(true);
  expect(rollDoorLock(50,()=>.499)).toBe(true);
  expect(rollDoorLock(50,()=>.5)).toBe(false);
  expect(rollDoorLock(-5,()=>0)).toBe(false);
  expect(rollDoorLock(500,()=>.999)).toBe(true);
  expect(rollDoorLock(NaN,()=>0)).toBe(false);
});

test('locked cars refuse entry with a message; unlocked cars start the approach',()=>{
  const sim=new Simulation(),clips=new VehicleAnimationLibrary('lock-test:'),entry=new CarEntry(sim,clips);
  const fake=(locked:boolean)=>({wrecked:false,locked,alarm:0,modelFlags:0,animGroup:{flags:0},seat:()=>undefined,worldPoint:()=>({x:0,y:0,z:0})}) as unknown as WorldCar;
  try{
    const denied=fake(true);
    expect(entry.enter(denied)).toBe(false);
    expect(entry.message).toBe('This car is locked.');
    expect(denied.alarm).toBe(CAR_ALARM_SECONDS);
    entry.cancel();
    const allowed=fake(false);
    expect(entry.enter(allowed)).toBe(true);
    expect(entry.message).toBeUndefined();
    expect(allowed.alarm).toBe(0);
  }finally{entry.cancel();sim.dispose();}
});

test('alarms count down and reach the horn as an active alarm state',()=>{
  expect(tickAlarm(8,1/60)).toBeCloseTo(8-1/60,10);
  expect(tickAlarm(.01,1)).toBe(0);
  expect(tickAlarm(0,1)).toBe(0);
  expect(tickAlarm(5,-1)).toBe(5);
  const audioCar=(alarm:number)=>({
    wrecked:false,occupied:false,autopilot:undefined,siren:false,alarm,gasPedal:0,gear:1,
    horn:{counter:0,pattern:0},
    car:{body:{translation:()=>({x:0,y:0,z:0}),rotation:()=>({x:0,y:0,z:0,w:1}),linvel:()=>({x:0,y:0,z:0})}},
    assets:{handling:{values:{driveType:'R',maxVelocity:.5,gears:5},maxReverseVelocity:-.2,gears:[]}},
    audio:{brakePedal:0,handbrake:false,accelerate:0,brake:0},
  }) as unknown as WorldCar;
  expect(worldCarAudioInput(audioCar(4),true).alarmState).toBe(1);
  expect(worldCarAudioInput(audioCar(0),true).alarmState).toBe(0);
});
