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
