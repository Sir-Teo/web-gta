import { expect, test } from 'vitest';
import { stepArrest, ARREST_HOLD_SECONDS } from '../src/police/pursuit';
import { shouldRecover } from '../src/traffic/driving';
import { recoveryLimit } from '../src/simulation/WorldTraffic';

test('arrest builds while holding, decays otherwise', () => {
  expect(ARREST_HOLD_SECONDS).toBeCloseTo(1.2, 6);
  expect(stepArrest(0, 0.5, true)).toBeCloseTo(0.5, 6);
  expect(stepArrest(0.5, 0.5, false)).toBeCloseTo(0, 6);
});

test('traffic recovery limits match WorldTraffic policy', () => {
  expect(recoveryLimit('obstacle')).toBe(20);
  expect(recoveryLimit('end of route')).toBe(8);
  expect(recoveryLimit(null)).toBe(0);
  expect(shouldRecover(21, 20)).toBe(true);
  expect(shouldRecover(5, 20)).toBe(false);
});
