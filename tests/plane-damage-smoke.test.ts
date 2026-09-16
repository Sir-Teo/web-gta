import {expect,test} from 'vitest';
import {planeDamageBand} from '../src/simulation/fx/WorldFx';

test('damaged aircraft smoke below 65% health and burn at or below 25%',()=>{
  expect(planeDamageBand(800)).toBe('none');
  expect(planeDamageBand(520)).toBe('none');
  expect(planeDamageBand(519)).toBe('smoke');
  expect(planeDamageBand(201)).toBe('smoke');
  expect(planeDamageBand(200)).toBe('fire');
  expect(planeDamageBand(1)).toBe('fire');
  expect(planeDamageBand(0)).toBe('none');
});
