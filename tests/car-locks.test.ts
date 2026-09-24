import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {CarEntry,nativeDoorPoint} from '../src/simulation/CarEntry';
import {VehicleAnimationLibrary} from '../src/assets/vehicleAnimations';
import {rollDoorLock} from '../src/assets/worldCarGenerators';
import {tickAlarm,type WorldCar} from '../src/simulation/WorldCar';
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

test('a locked car is still walked to: the rattle at its door is CTaskSimpleCarOpenLockedDoorFromOutside, with no alarm',()=>{
  const sim=new Simulation(),clips=new VehicleAnimationLibrary('lock-test:'),entry=new CarEntry(sim,clips);
  const fake=(locked:boolean)=>({wrecked:false,onFire:false,locked,alarm:0,modelFlags:0,animGroup:{flags:0},seat:()=>undefined,worldPoint:()=>({x:0,y:0,z:0})}) as unknown as WorldCar;
  try{
    const locked=fake(true);
    expect(entry.enter(locked)).toBe(true);expect(entry.snapshot().phase).toBe('approach');expect(locked.alarm).toBe(0);
    entry.cancel();
    const burning={...fake(false),onFire:true} as unknown as WorldCar;
    expect(entry.enter(burning)).toBe(false);
  }finally{entry.cancel();sim.dispose();}
});

test('alarms count down and reach the horn as an active alarm state',()=>{  expect(tickAlarm(8,1/60)).toBeCloseTo(8-1/60,10);
  expect(tickAlarm(.01,1)).toBe(0);
  expect(tickAlarm(0,1)).toBe(0);
  expect(tickAlarm(5,-1)).toBe(5);
  const audioCar=(alarm:number)=>({
    wrecked:false,occupied:false,autopilot:undefined,siren:false,alarm,gasPedal:0,gear:1,
    horn:{counter:0,pattern:0},
    car:{body:{translation:()=>({x:0,y:0,z:0}),rotation:()=>({x:0,y:0,z:0,w:1}),linvel:()=>({x:0,y:0,z:0})},nitro:{installed:false,burning:false,boosts:0}},
    assets:{handling:{values:{driveType:'R',maxVelocity:.5,gears:5},maxReverseVelocity:-.2,gears:[]}},
    audio:{brakePedal:0,handbrake:false,accelerate:0,brake:0},
  }) as unknown as WorldCar;
  expect(worldCarAudioInput(audioCar(4),true).alarmState).toBe(1);
  expect(worldCarAudioInput(audioCar(0),true).alarmState).toBe(0);
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
