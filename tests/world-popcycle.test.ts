import { expect, test } from 'vitest';
import { trafficDriverBudget, clampBudget, spawnBand } from '../src/world/popcycle';

test('budgets clamp to device ceilings with driver share', () => {
  expect(clampBudget(999, 999)).toEqual({ peds: 36, cars: 44 });
  expect(trafficDriverBudget(44)).toBe(7);
  expect(trafficDriverBudget(4)).toBe(2);
  expect(spawnBand(1)).toEqual({ min: 40, max: 50 });
});
