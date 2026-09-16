import { expect, test } from 'vitest';
import { onscreenSpawnBand, offscreenSpawnBand, pedCreationDistMultiplier, visibleSpawnAllowed, gangPartySize, gangFormationOffset, managePed } from '../src/simulation/nativePopulation';

test('creation bands match re3 MIN 40 RANGE 10 OFFSCREEN 0.5', () => {
  expect(onscreenSpawnBand(1)).toEqual({ min: 40, max: 50 });
  expect(offscreenSpawnBand(1)).toEqual({ min: 15, max: 25 });
  expect(pedCreationDistMultiplier(0)).toBe(1);
  expect(pedCreationDistMultiplier(10)).toBeCloseTo(1.5, 6);
});

test('visible spawns require the 42.5m gate', () => {
  expect(visibleSpawnAllowed(42.5, 1)).toBe(true);
  expect(visibleSpawnAllowed(42.4, 1)).toBe(false);
});

test('gang parties follow the 50/7/17/11/15 split', () => {
  expect(gangPartySize(49)).toBe(0);
  expect(gangPartySize(50)).toBe(1);
  expect(gangPartySize(60)).toBe(2);
  expect(gangPartySize(80)).toBe(3);
  expect(gangPartySize(90)).toBe(4);
});

test('gang formation spreads members 0.75 units apart per index', () => {
  const zeros = gangFormationOffset(0, () => 0);
  expect(zeros.x + 0).toBe(0);
  expect(zeros.z + 0).toBe(0);
  const second = gangFormationOffset(1, () => 0.999);
  // Base 0.75 plus up to 0.75 jitter on each axis, positive signs.
  expect(second.x).toBeGreaterThan(0.75);
  expect(second.x).toBeLessThanOrEqual(1.5);
  expect(second.z).toBeGreaterThan(0.75);
  expect(second.z).toBeLessThanOrEqual(1.5);
});

test('ManagePed keeps onscreen peds and expires the grace', () => {
  expect(managePed({ distance2D: 60, pcdm: 1, onScreen: true, farAwayCull: false, graceExpires: 0, now: 99999, sniperMode: false, lookingAside: false })).toBe('fade');
  expect(managePed({ distance2D: 60, pcdm: 1, onScreen: false, farAwayCull: false, graceExpires: 0, now: 99999, sniperMode: false, lookingAside: false })).toBe('remove');
  expect(managePed({ distance2D: 40, pcdm: 1, onScreen: false, farAwayCull: false, graceExpires: 99999, now: 0, sniperMode: false, lookingAside: false })).toBe('keep');
});
