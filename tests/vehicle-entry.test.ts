import { expect, test } from 'vitest';
import { approachStall, canEnterCar, nextEntryPhase, exitPhaseForSpeed } from '../src/vehicle/entry';

test('entry guards enforce speed, lock and blocked doors', () => {
  expect(canEnterCar({ carSpeed2D: 0, locked: false, doorBlocked: false, victimInside: false })).toBe('ok');
  expect(canEnterCar({ carSpeed2D: 1, locked: false, doorBlocked: false, victimInside: false })).toBe('too-fast');
  expect(canEnterCar({ carSpeed2D: 0, locked: true, doorBlocked: false, victimInside: false })).toBe('locked');
  expect(canEnterCar({ carSpeed2D: 0, locked: false, doorBlocked: true, victimInside: false })).toBe('blocked');
});

test('driver sequence inserts pullout only when jacking', () => {
  expect(nextEntryPhase('open', true)).toBe('pullout');
  expect(nextEntryPhase('open', false)).toBe('getIn');
  expect(nextEntryPhase('getIn', false)).toBe('closeInside');
  expect(nextEntryPhase('shuffle', false)).toBe('seated');
});

test('the approach stall clock runs on the ground only: a jump the enter press came in is not a blocked door', () => {
  let stall = 0;
  for (let i = 0; i < 90; i++) stall = approachStall(stall, 1 / 60, false);
  expect(stall).toBe(0);
  for (let i = 0; i < 30; i++) stall = approachStall(stall, 1 / 60, true);
  expect(stall).toBeCloseTo(.5, 6);
  expect(approachStall(stall, 1, false)).toBeCloseTo(.5, 6);
});

test('fast exits jump out, slow exits step out', () => {
  expect(exitPhaseForSpeed(0)).toBe('getOut');
  expect(exitPhaseForSpeed(5)).toBe('jumpOut');
});
