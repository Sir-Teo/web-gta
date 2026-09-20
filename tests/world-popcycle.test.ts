import { expect, test } from 'vitest';
import { trafficDriverBudget, clampBudget, spawnBand } from '../src/world/popcycle';

test('budgets clamp to device ceilings with driver share', () => {
  expect(clampBudget(999, 999)).toEqual({ peds: 36, cars: 44 });
  expect(trafficDriverBudget(44)).toBe(14);expect(trafficDriverBudget(12)).toBe(12);
  expect(trafficDriverBudget(4)).toBe(4);
  expect(spawnBand(1)).toEqual({ min: 40, max: 50 });
});
