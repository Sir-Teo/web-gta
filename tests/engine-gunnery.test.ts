import { expect, test } from 'vitest';
import { projectileTuning } from '../src/weapons/nativeProjectile';

test('projectile tuning', () => {
  expect(projectileTuning('rocket').gravity).toBe(0);
  // CPhysical's 0.008 units a frame squared, which the thrown ones fall at (20 a second squared).
  expect(projectileTuning('grenade').gravity).toBeCloseTo(20, 4);
});
