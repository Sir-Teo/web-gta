import { expect, test } from 'vitest';
import { canEnterCar, nextEntryPhase, exitPhaseForSpeed } from '../src/vehicle/entry';

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

test('fast exits jump out, slow exits step out', () => {
  expect(exitPhaseForSpeed(0)).toBe('getOut');
  expect(exitPhaseForSpeed(5)).toBe('jumpOut');
});
