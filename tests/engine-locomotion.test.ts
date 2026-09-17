import { expect, test } from 'vitest';
import { NATIVE_WALK_SPEED, NATIVE_RUN_SPEED, NATIVE_SPRINT_SPEED, stepStamina } from '../src/locomotion/player';
import { landingDamage, applyArmour } from '../src/health/survival';

test('locomotion speeds match ped.ifp root motion', () => {
  expect(NATIVE_WALK_SPEED).toBeCloseTo(1.556, 3);
  expect(NATIVE_RUN_SPEED).toBeCloseTo(5.706, 3);
  expect(NATIVE_SPRINT_SPEED).toBeCloseTo(9.562, 3);
});

test('stamina drains sprinting, regens idle', () => {
  expect(stepStamina(100, true, true, 1)).toBeCloseTo(93, 6);
  expect(stepStamina(0, false, false, 1)).toBeCloseTo(22, 6);
});

test('landing damage and armour order', () => {
  expect(landingDamage(-5)).toBe(0);
  expect(landingDamage(-20)).toBeGreaterThan(0);
  expect(applyArmour(100, 50, 30)).toEqual([100, 20]);
  expect(applyArmour(100, 0, 30)).toEqual([70, 0]);
});
