import { expect, test } from 'vitest';
import { projectileTuning, proficiencySpread } from '../src/weapons/gunnery';

test('projectile tuning and proficiency spread', () => {
  expect(projectileTuning('rocket').gravity).toBe(0);
  expect(projectileTuning('grenade').gravity).toBeCloseTo(9.81, 2);
  expect(proficiencySpread('pro')).toBeLessThan(proficiencySpread('poor'));
});
