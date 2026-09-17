import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {CarEntry,nativeDoorPoint} from '../src/simulation/CarEntry';
import {VehicleAnimationLibrary} from '../src/assets/vehicleAnimations';
import {rollDoorLock} from '../src/assets/worldCarGenerators';
import {CAR_ALARM_SECONDS,tickAlarm,type WorldCar} from '../src/simulation/WorldCar';
import {setCarLightState} from '../src/render/nativeCarLightMaterials';
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
    let reported:unknown;
    entry.onBreakIn=(car)=>{reported=car;};
    expect(entry.enter(denied)).toBe(false);
    expect(entry.message).toBe('This car is locked.');
    expect(denied.alarm).toBe(CAR_ALARM_SECONDS);
    expect(reported).toBe(denied);
    entry.cancel();entry.onBreakIn=undefined;
    const allowed=fake(false);
    expect(entry.enter(allowed)).toBe(true);
    expect(entry.message).toBeUndefined();
    expect(allowed.alarm).toBe(0);
  }finally{entry.cancel();sim.dispose();}
});

test('alarms count down and reach the horn as an active alarm state',()=>{  expect(tickAlarm(8,1/60)).toBeCloseTo(8-1/60,10);
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

test('rattling a lock three times within 30 s picks it',()=>{
  const sim=new Simulation(),clips=new VehicleAnimationLibrary('pick-test:'),entry=new CarEntry(sim,clips);
  const car={locked:true} as unknown as WorldCar;
  try{
    expect(entry.pickLock(car)).toBe('locked');
    expect(car.locked).toBe(true);
    for(let i=0;i<60;i++)entry.step(1/60,{pedal:false,moving:false});
    expect(entry.pickLock(car)).toBe('locked');
    for(let i=0;i<60*29;i++)entry.step(1/60,{pedal:false,moving:false});
    expect(entry.pickLock(car)).toBe('picked');
    expect(car.locked).toBe(false);
  }finally{entry.cancel();sim.dispose();}
});

test('stale rattles expire after 30 s',()=>{
  const sim=new Simulation(),clips=new VehicleAnimationLibrary('pick-expiry:'),entry=new CarEntry(sim,clips);
  const car={locked:true} as unknown as WorldCar;
  try{
    expect(entry.pickLock(car)).toBe('locked');
    expect(entry.pickLock(car)).toBe('locked');
    for(let i=0;i<60*31;i++)entry.step(1/60,{pedal:false,moving:false});
    expect(entry.pickLock(car)).toBe('locked');
    expect(car.locked).toBe(true);
  }finally{entry.cancel();sim.dispose();}
});

test('door points clear swung-open doors',()=>{
  const seat={x:1,y:0,z:0},end={x:0.2,y:0.1,z:0.1};
  const closed=nativeDoorPoint(seat,end,0.5,'right',1,0);
  const ajar=nativeDoorPoint(seat,end,0.5,'right',1,1.0);
  expect(ajar.x).toBeGreaterThan(closed.x);
  const left=nativeDoorPoint({x:-1,y:0,z:0},end,0.5,'left',1,1.0);
  expect(left.x).toBeLessThan(-1);
});

test('active light switching brightens brake and headlight lamps',()=>{
  const colors:Record<string,[number,number,number]>={};
  const binding=(slot:'leftRear'|'rightRear'|'leftFront'|'rightFront')=>({binding:{material:{color:{setRGB:(r:number,g:number,b:number)=>{colors[slot]=[r,g,b];}}}},slot});
  const targets=[binding('leftRear'),binding('rightRear'),binding('leftFront'),binding('rightFront')];
  setCarLightState(targets,{brake:true,headlights:false});
  expect(colors.leftRear[0]).toBeGreaterThan(2);
  expect(colors.leftFront).toEqual([1,1,1]);
  setCarLightState(targets,{brake:false,headlights:true});
  expect(colors.leftRear).toEqual([1,1,1]);
  expect(colors.rightFront[0]).toBeGreaterThan(1.5);
});
