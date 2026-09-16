import { expect, test } from 'vitest';
import { sirenNear, SIREN_YIELD_RADIUS } from '../src/simulation/WorldTraffic';

test('siren yield covers the lane around the emergency vehicle', () => {
  expect(SIREN_YIELD_RADIUS).toBe(25);
  const at = { x: 0, z: 0 };
  expect(sirenNear([{ x: 10, z: 0 }], at)).toEqual({ x: 10, z: 0 });
  expect(sirenNear([{ x: 30, z: 0 }], at)).toBeUndefined();
  expect(sirenNear([], at)).toBeUndefined();
  expect(sirenNear([{ x: NaN, z: 0 }, { x: 5, z: 5 }], at)).toEqual({ x: 5, z: 5 });
});
