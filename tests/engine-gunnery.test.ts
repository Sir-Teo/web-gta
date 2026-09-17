import { expect, test } from 'vitest';
import { lockScore, projectileTuning, proficiencySpread } from '../src/weapons/gunnery';

test('lock-on scores ahead over behind, in range only', () => {
  const origin = { x: 0, y: 1, z: 0 }, fwd = { x: 0, y: 0, z: 1 };
  const ahead = lockScore(origin, fwd, { x: 0, y: 1, z: 10 }, 50);
  const behind = lockScore(origin, fwd, { x: 0, y: 1, z: -10 }, 50);
  expect(ahead).toBeGreaterThan(behind);
  expect(lockScore(origin, fwd, { x: 0, y: 1, z: 500 }, 50)).toBe(0);
});

test('projectile tuning and proficiency spread', () => {
  expect(projectileTuning('rocket').gravity).toBe(0);
  expect(projectileTuning('grenade').gravity).toBeCloseTo(9.81, 2);
  expect(proficiencySpread('pro')).toBeLessThan(proficiencySpread('poor'));
});
