import { expect, test } from 'vitest';
import { stallAuthority } from '../src/flight/aero';
import { wetRoadsFromRain } from '../src/world/weather';
import { activityReward } from '../src/progression/economy';

test('aero/weather/progression glue', () => {
  expect(stallAuthority(100, 50)).toBe(1);
  expect(stallAuthority(10, 50)).toBeLessThan(1);
  expect(wetRoadsFromRain(0)).toBe(0);
  expect(wetRoadsFromRain(1)).toBe(1);
  expect(activityReward(true, false, 500)).toBe(500);
  expect(activityReward(true, true, 500)).toBe(0);
});
