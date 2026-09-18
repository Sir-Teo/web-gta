import { expect, test } from 'vitest';
import { dispatchForChaos, helisRequired, roadblockAllowed } from '../src/police/dispatch';

test('chaos rows set stars, caps and roadblock chance', () => {
  expect(dispatchForChaos(0).level).toBe(0);
  expect(dispatchForChaos(50).level).toBe(1);
  expect(dispatchForChaos(570)).toMatchObject({ level: 3, maxCops: 4, maxCopCars: 2 });
  expect(dispatchForChaos(4600).level).toBe(6);
});

test('heli and roadblock rules', () => {
  expect(helisRequired(2)).toBe(0);
  expect(helisRequired(3)).toBe(1);
  expect(helisRequired(5)).toBe(2);
  expect(roadblockAllowed(2)).toBe(false);
  expect(roadblockAllowed(3)).toBe(true);
});
