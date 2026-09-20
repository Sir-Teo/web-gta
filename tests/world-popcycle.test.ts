import {rollAlarm,generatorFlags,parkedCarLimit,generatorInRange} from '../src/assets/worldCarGenerators';
import { expect, test } from 'vitest';
import { trafficDriverBudget, clampBudget, spawnBand } from '../src/world/popcycle';

test('budgets clamp to device ceilings with driver share', () => {
  expect(clampBudget(999, 999)).toEqual({ peds: 36, cars: 44 });
  expect(trafficDriverBudget(44)).toBe(14);expect(trafficDriverBudget(12)).toBe(12);
  expect(trafficDriverBudget(4)).toBe(4);
  expect(spawnBand(1)).toEqual({ min: 40, max: 50 });
});

import {handlingIdOf,isBuildableCar,FIXED_CAR_HANDLING_IDS} from '../src/assets/fixedWorldCar';
test('handling ids come from the fixed table first and the handling.cfg line order otherwise',()=>{
  const catalog={handling:{records:[{name:'ALPHA'},{name:'POLICE_SF'},{name:'POLICE_LA'},{name:'SENTINEL'}] as any}} as any;
  expect(handlingIdOf(catalog,'SENTINEL')).toBe(3);
  expect(handlingIdOf(catalog,'AMBULAN')).toBe(FIXED_CAR_HANDLING_IDS.AMBULAN);
  expect(handlingIdOf(catalog,'NOPE')).toBeUndefined();
  expect(isBuildableCar(catalog,{type:'car',handling:'SENTINEL'})).toBe(true);
  expect(isBuildableCar(catalog,{type:'bike',handling:'SENTINEL'})).toBe(false);
  expect(isBuildableCar(catalog,{type:'car',handling:'NOPE'})).toBe(false);
});

test('a generator record arms an alarm by its alarmChance percentage',()=>{
 expect(rollAlarm(0,()=>0)).toBe(false);expect(rollAlarm(100,()=>0.99)).toBe(true);
 expect(rollAlarm(30,()=>0.29)).toBe(true);expect(rollAlarm(30,()=>0.31)).toBe(false);expect(rollAlarm(NaN,()=>0)).toBe(false);
});

test('car generator flags, parked limits and the approach band follow CCarGenerator',()=>{
 expect(generatorFlags(0)).toEqual({forceSpawn:false,ignorePopulationLimit:false});expect(generatorFlags(3)).toEqual({forceSpawn:true,ignorePopulationLimit:true});
 expect(parkedCarLimit(12)).toBe(5);expect(parkedCarLimit(21)).toBe(10);expect(parkedCarLimit(6)).toBe(10);expect(parkedCarLimit(7)).toBe(5);
 const still={x:0,y:0};
 // Too high, or out of range (which also clears the wait flag).
 expect(generatorInRange({x:10,y:0},60,still,false,false,0)).toEqual({eligible:false,waitFar:false});
 expect(generatorInRange({x:170,y:0},0,still,true,false,0)).toEqual({eligible:false,waitFar:false});
 // The start window allows any spawn; a waiting generator none.
 expect(generatorInRange({x:10,y:0},0,still,false,false,5)).toEqual({eligible:true,waitFar:false});
 expect(generatorInRange({x:150,y:0},0,still,true,false,0)).toEqual({eligible:false,waitFar:true});
 // Otherwise only the 140 to 160 band while heading toward it (the player is at +x, moving -x).
 expect(generatorInRange({x:150,y:0},0,{x:-1,y:0},false,false,0).eligible).toBe(true);
 expect(generatorInRange({x:150,y:0},0,{x:1,y:0},false,false,0).eligible).toBe(false);
 expect(generatorInRange({x:100,y:0},0,{x:-1,y:0},false,false,0).eligible).toBe(false);
 expect(generatorInRange({x:100,y:0},0,{x:-1,y:0},false,true,0).eligible).toBe(true);
});
