import { expect, test } from 'vitest';
import { stepMoveBlend, targetMoveBlend, blendToSpeed, blendTurnRate, NATIVE_BLEND_RUN, NATIVE_BLEND_SPRINT, NATIVE_BLEND_WALK } from '../src/simulation/nativePlayerLocomotion';
import { NATIVE_RUN_SPEED, NATIVE_SPRINT_SPEED, NATIVE_WALK_SPEED } from '../src/simulation/Simulation';

test('native blend targets match SetPlayerMoveBlendRatio stops', () => {
  expect(targetMoveBlend(0, false, false)).toBe(0);
  expect(targetMoveBlend(1, true, false)).toBe(NATIVE_BLEND_WALK);
  expect(targetMoveBlend(1, false, false)).toBe(NATIVE_BLEND_RUN);
  expect(targetMoveBlend(1, false, true)).toBe(NATIVE_BLEND_SPRINT);
});

test('blend slews at the native 0.07 per 1/50 s TimeStep', () => {
  expect(stepMoveBlend(0, 2.5, 1 / 50)).toBeCloseTo(0.07, 6);
  expect(stepMoveBlend(0, 2.5, 1 / 60)).toBeCloseTo(0.07 * 50 / 60, 6);
  expect(stepMoveBlend(0, 0.05, 1 / 60)).toBeCloseTo(0.05, 6);
  expect(stepMoveBlend(2.5, 0, 1)).toBe(0);
});

test('blend maps through ped.ifp root-motion speeds', () => {
  expect(blendToSpeed(0)).toBe(0);
  expect(blendToSpeed(NATIVE_BLEND_WALK)).toBeCloseTo(NATIVE_WALK_SPEED, 6);
  expect(blendToSpeed(NATIVE_BLEND_RUN)).toBeCloseTo(NATIVE_RUN_SPEED, 6);
  expect(blendToSpeed(NATIVE_BLEND_SPRINT)).toBeCloseTo(NATIVE_SPRINT_SPEED, 6);
});

test('turns are slower at sprint blend', () => {
  expect(blendTurnRate(0)).toBeCloseTo(11, 6);
  expect(blendTurnRate(NATIVE_BLEND_SPRINT)).toBeCloseTo(8, 6);
});
