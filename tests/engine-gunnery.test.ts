import { expect, test } from 'vitest';
import { projectileTuning, proficiencySpread } from '../src/weapons/gunnery';

test('projectile tuning and proficiency spread', () => {
  expect(projectileTuning('rocket').gravity).toBe(0);
  // CPhysical's 0.008 units a frame squared, which the thrown ones fall at (20 a second squared).
  expect(projectileTuning('grenade').gravity).toBeCloseTo(20, 4);
  expect(proficiencySpread('pro')).toBeLessThan(proficiencySpread('poor'));
});
