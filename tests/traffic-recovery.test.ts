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
    expect(fleet.pedLimits()).toBeUndefined();
    expect(fleet.trafficDrivers()).toBeUndefined();
  }finally{fleet.dispose();sim.dispose();}
});

test('an aircraft cleared out of the world frees its generator to make another',()=>{
  const sim=new Simulation(),scene=new Scene();
  const fleet=new WorldFleet(sim,scene,{} as never,undefined,'plane-generator-test:');
  try{
    const plane={occupied:false,missionCar:false,disposed:false,policeHeli:false,car:{body:{translation:()=>({x:0,y:0,z:0})}},cancelEntry(){},dispose(){this.disposed=true;}} as any;
    fleet.planes.add(plane);(fleet as any).generatedPlanes.set(plane,'airport-1');(fleet as any).attempted.add('airport-1');
    expect(fleet.clearCarsInArea({x:0,z:0},50)).toBe(1);
    expect(plane.disposed).toBe(true);
    expect(fleet.planes.has(plane)).toBe(false);
    expect((fleet as any).attempted.has('airport-1')).toBe(false);
    expect((fleet as any).generatedPlanes.size).toBe(0);
  }finally{fleet.dispose();sim.dispose();}
});

test('an aircraft the player is still climbing out of is left to him, and removing it sets him down first',()=>{
  const sim=new Simulation(),scene=new Scene();
  const fleet=new WorldFleet(sim,scene,{} as never,undefined,'plane-getout-test:');
  try{
    let finished=0;
    const plane={occupied:false,missionCar:false,disposed:false,entryBusy:true,car:{body:{translation:()=>({x:0,y:0,z:0})}},cancelEntry(){finished++;this.entryBusy=false;},dispose(){this.disposed=true;}} as any;
    fleet.planes.add(plane);
    expect(fleet.clearCarsInArea({x:0,z:0},50)).toBe(0);
    expect(plane.disposed).toBe(false);
    fleet.removePlane(plane);
    expect(finished).toBe(1);expect(plane.disposed).toBe(true);
  }finally{fleet.dispose();sim.dispose();}
});
