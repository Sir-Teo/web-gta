import { expect, test } from 'vitest';
import { wetGripFactor, clampSteer, isStopped } from '../src/vehicle/chassis';

test('wet grip falls with rain, never below the floor', () => {
  expect(wetGripFactor(0, 0)).toBeCloseTo(1, 6);
  const wet = wetGripFactor(255, 1);
  expect(wet).toBeLessThan(1);
  expect(wet).toBeGreaterThanOrEqual(0.4);
});

test('steering clamps and narrows with speed', () => {
  expect(clampSteer(99, 0.6, 0)).toBeCloseTo(0.6, 6);
  expect(clampSteer(-99, 0.6, 0)).toBeCloseTo(-0.6, 6);
  expect(Math.abs(clampSteer(99, 0.6, 1))).toBeLessThan(0.6);
  expect(isStopped(0.1)).toBe(true);
  expect(isStopped(5)).toBe(false);
});
