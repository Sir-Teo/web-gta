import {expect,test} from 'vitest';
import {recoveryLimit} from '../src/simulation/WorldTraffic';

test('traffic recovery waits at lights, clears dead ends fast and jams slowly',()=>{
  expect(recoveryLimit(null)).toBe(0);
  expect(recoveryLimit('traffic light')).toBe(0);
  expect(recoveryLimit('end of route')).toBe(8);
  expect(recoveryLimit('off route')).toBe(8);
  expect(recoveryLimit('unloaded road')).toBe(8);
  expect(recoveryLimit('obstacle')).toBe(20);
});
