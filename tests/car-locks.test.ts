import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {CarEntry} from '../src/simulation/CarEntry';
import {VehicleAnimationLibrary} from '../src/assets/vehicleAnimations';
import {rollDoorLock} from '../src/assets/worldCarGenerators';
import type {WorldCar} from '../src/simulation/WorldCar';

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
  const fake=(locked:boolean)=>({wrecked:false,locked,modelFlags:0,animGroup:{flags:0},seat:()=>undefined,worldPoint:()=>({x:0,y:0,z:0})}) as unknown as WorldCar;
  try{
    expect(entry.enter(fake(true))).toBe(false);
    expect(entry.message).toBe('This car is locked.');
    expect(entry.enter(fake(false))).toBe(true);
    expect(entry.message).toBeUndefined();
  }finally{entry.cancel();sim.dispose();}
});
