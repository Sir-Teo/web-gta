import { expect, test } from 'vitest';
import { NATIVE_WALK_SPEED, NATIVE_RUN_SPEED, NATIVE_SPRINT_SPEED, stepStamina } from '../src/locomotion/player';
import { landingDamage } from '../src/simulation/health';

test('locomotion speeds match ped.ifp root motion', () => {
  expect(NATIVE_WALK_SPEED).toBeCloseTo(1.556, 3);
  expect(NATIVE_RUN_SPEED).toBeCloseTo(5.706, 3);
  expect(NATIVE_SPRINT_SPEED).toBeCloseTo(9.562, 3);
});

test('stamina drains sprinting, regens idle', () => {
  expect(stepStamina(100, true, true, 1)).toBeCloseTo(50, 6);
  expect(stepStamina(0, false, false, 1)).toBeCloseTo(25, 6);
});

test('landing damage and armour order', () => {
  expect(landingDamage(-5)).toBe(0);
  expect(landingDamage(-20)).toBeGreaterThan(0);
});

// iOS ped collision 0x10032803c..0x1003282f4: units a frame (the browser's a second over 50).
test('landing damage is the ped collision\'s WEAPON_FALL', () => {
  // Under the 0.375 a frame gate (18.75 a second), nothing, unless still in FALL_FALL: 15.
  expect(landingDamage(-18)).toBe(0);
  expect(landingDamage(-18, { fallFall: true })).toBe(15);
  expect(landingDamage(-0.5, { fallFall: true })).toBe(0);
  // Past it, (−0.25 − down) × 400: 0.4 a frame is 60; a soft landing's offset is 0.375.
  expect(landingDamage(-20)).toBeCloseTo(60, 4);
  expect(landingDamage(-20, { soft: true })).toBeCloseTo(10, 4);
  // Across faster than 0.66 a frame adds (across − 0.25) × 100; down past 0.6 a frame is 500.
  expect(landingDamage(0, { across: 35 })).toBeCloseTo(45, 4);
  expect(landingDamage(-31)).toBe(500);
  // A ped out of PEDSTATE_IDLE: the 0.25 gate.
  expect(landingDamage(-15, { idle: false })).toBeCloseTo(20, 4);
});
