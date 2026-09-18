import { expect, test } from 'vitest';
import { shouldRecover } from '../src/traffic/driving';
import { recoveryLimit } from '../src/simulation/WorldTraffic';

test('traffic recovery limits match WorldTraffic policy', () => {
  expect(recoveryLimit('obstacle')).toBe(20);
  expect(recoveryLimit('end of route')).toBe(8);
  expect(recoveryLimit(null)).toBe(0);
  expect(shouldRecover(21, 20)).toBe(true);
  expect(shouldRecover(5, 20)).toBe(false);
});
