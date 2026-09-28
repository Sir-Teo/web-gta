import { expect, test } from 'vitest';
import { stepMoveBlend, targetMoveBlend, blendToSpeed, playerTurnStep, NATIVE_BLEND_RUN, NATIVE_BLEND_SPRINT, NATIVE_BLEND_WALK } from '../src/simulation/nativePlayerLocomotion';
import { NATIVE_RUN_SPEED, NATIVE_SPRINT_SPEED, NATIVE_WALK_SPEED } from '../src/simulation/Simulation';

test('PlayerControlZelda targets the stick over 60, walk capped at 1, sprint no larger', () => {
  expect(targetMoveBlend(0, false, false)).toBe(0);
  expect(targetMoveBlend(1, true, false)).toBe(NATIVE_BLEND_WALK);
  expect(targetMoveBlend(1, false, false)).toBeCloseTo(128 / 60, 6);
  expect(targetMoveBlend(1, false, true)).toBeCloseTo(128 / 60, 6);
  expect(targetMoveBlend(.25, false, false)).toBeCloseTo(32 / 60, 6);
  expect(targetMoveBlend(.25, true, false)).toBeCloseTo(32 / 60, 6);
  // The script's own stops stay where SetPlayerMoveBlendRatio has them.
  expect([NATIVE_BLEND_RUN, NATIVE_BLEND_SPRINT]).toEqual([1.8, 2.5]);
});

test('blend slews at the native 0.07 per 1/50 s TimeStep', () => {
  expect(stepMoveBlend(0, 2.5, 1 / 50)).toBeCloseTo(0.07, 6);
  expect(stepMoveBlend(0, 2.5, 1 / 60)).toBeCloseTo(0.07 * 50 / 60, 6);
  expect(stepMoveBlend(0, 0.05, 1 / 60)).toBeCloseTo(0.05, 6);
  expect(stepMoveBlend(2.5, 0, 1)).toBe(0);
});

test('blend maps through ped.ifp root-motion speeds: walk to 1, run from 2, sprint as a state', () => {
  expect(blendToSpeed(0)).toBe(0);
  expect(blendToSpeed(NATIVE_BLEND_WALK)).toBeCloseTo(NATIVE_WALK_SPEED, 6);
  expect(blendToSpeed(1.5)).toBeCloseTo((NATIVE_WALK_SPEED + NATIVE_RUN_SPEED) / 2, 6);
  expect(blendToSpeed(2)).toBeCloseTo(NATIVE_RUN_SPEED, 6);
  expect(blendToSpeed(128 / 60)).toBeCloseTo(NATIVE_RUN_SPEED, 6);
  expect(blendToSpeed(128 / 60, true)).toBeCloseTo(NATIVE_SPRINT_SPEED, 6);
  expect(blendToSpeed(1.5, true)).toBeCloseTo((NATIVE_WALK_SPEED + NATIVE_RUN_SPEED) / 2, 6);
});

test('the player turns at STAT_PLAYER\'s heading change rate', () => {
  // STAT_PLAYER's 9 degrees per TimeStep: 450 degrees a second.
  expect(playerTurnStep(1)).toBeCloseTo(450 * Math.PI / 180, 6);
});
