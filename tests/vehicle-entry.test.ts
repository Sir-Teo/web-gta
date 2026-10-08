import { expect, test } from 'vitest';
import { approachStall, nextEntryPhase } from '../src/vehicle/entry';

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

