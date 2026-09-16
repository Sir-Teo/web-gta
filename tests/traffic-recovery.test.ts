import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Scene} from 'three';
import {Simulation} from '../src/simulation/Simulation';
import {WorldFleet} from '../src/simulation/WorldFleet';
import {recoveryLimit} from '../src/simulation/WorldTraffic';

beforeAll(async()=>{await RAPIER.init();});

test('traffic recovery waits at lights, clears dead ends fast and jams slowly',()=>{
  expect(recoveryLimit(null)).toBe(0);
  expect(recoveryLimit('traffic light')).toBe(0);
  expect(recoveryLimit('end of route')).toBe(8);
  expect(recoveryLimit('off route')).toBe(8);
  expect(recoveryLimit('unloaded road')).toBe(8);
  expect(recoveryLimit('obstacle')).toBe(20);
});

test('traffic models cycle the fixed trio without zones or catalog',()=>{
  const sim=new Simulation(),scene=new Scene();
  const fleet=new WorldFleet(sim,scene,{} as never,undefined,'traffic-model-test:');
  try{
    expect([fleet.trafficModel(),fleet.trafficModel(),fleet.trafficModel(),fleet.trafficModel()]).toEqual([492,404,551,492]);
  }finally{fleet.dispose();sim.dispose();}
});
