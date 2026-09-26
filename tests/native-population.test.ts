import { expect, test } from 'vitest';
import { onscreenSpawnBand, offscreenSpawnBand, pedCreationDistMultiplier, visibleSpawnAllowed, gangPartySize, gangFormationOffset, gangHostile, gangPartyArmed, separationPush, SEPARATION_RADIUS, GANG_RIVALS, TURF_KILL_THREATS_CHANCE, gangPedType, managePed } from '../src/simulation/nativePopulation';

test('creation bands match re3 MIN 40 RANGE 10 OFFSCREEN 0.5', () => {
  expect(onscreenSpawnBand(1)).toEqual({ min: 42.5, max: 50.5 });
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

test('rivals no longer jump the player by turf alone; only a weak mark is leaned on', () => {
  expect([...GANG_RIVALS].sort()).toEqual([0, 2]);
  expect(gangHostile(0, 5)).toBe(false);
  expect(gangHostile(2, 11.9)).toBe(false);
  expect(gangHostile(0, 4, 20)).toBe(true);
  expect(gangHostile(1, 4, 20)).toBe(false);
  expect(gangHostile(7, 6, 20)).toBe(false);
  expect(gangHostile(undefined, 5)).toBe(false);
  expect(TURF_KILL_THREATS_CHANCE).toBeCloseTo(2 / 7);
  expect(gangPedType(0)).toBe(7);
});

test('escalated parties arm one pistol against armed or wanted marks', () => {
  expect(gangPartyArmed(1, true, 0)).toBe(false);
  expect(gangPartyArmed(3, false, 0)).toBe(false);
  expect(gangPartyArmed(3, true, 0)).toBe(true);
  expect(gangPartyArmed(2, false, 2)).toBe(true);
});

test('crowd separation pushes overlapping peds apart and ignores distance', () => {
  expect(SEPARATION_RADIUS).toBe(0.55);
  const push = separationPush({ x: 0, z: 0 }, [{ x: 0.3, z: 0 }]);
  expect(push.x).toBeLessThan(0);
  expect(push.z).toBe(0);
  expect(Math.hypot(push.x, push.z)).toBeLessThanOrEqual(1);
  expect(separationPush({ x: 0, z: 0 }, [{ x: 5, z: 5 }])).toEqual({ x: 0, z: 0 });
  expect(separationPush({ x: 0, z: 0 }, [])).toEqual({ x: 0, z: 0 });
});

test('ManagePed keeps onscreen peds and expires the grace', () => {
  expect(managePed({ distance2D: 60, pcdm: 1, onScreen: true, farAwayCull: false, graceExpires: 0, now: 99999, sniperMode: false, lookingAside: false })).toBe('fade');
  expect(managePed({ distance2D: 60, pcdm: 1, onScreen: false, farAwayCull: false, graceExpires: 0, now: 99999, sniperMode: false, lookingAside: false })).toBe('remove');
  expect(managePed({ distance2D: 40, pcdm: 1, onScreen: false, farAwayCull: false, graceExpires: 99999, now: 0, sniperMode: false, lookingAside: false })).toBe('keep');
});

test('respect gates neutral gangs and rewards rival kills',async()=>{
  const pop=await import('../src/simulation/nativePopulation');
  expect(pop.gangRespect()).toBe(40);
  expect(pop.gangHostile(3,4)).toBe(false);
  pop.addRespect(-30);
  expect(pop.gangRespect()).toBe(10);
  expect(pop.gangHostile(3,4)).toBe(true);
  expect(pop.gangHostile(1,4)).toBe(false);
  expect(pop.gangHostile(0,11)).toBe(false);
  pop.addRespect(200);
  expect(pop.gangRespect()).toBe(100);
  expect(pop.gangHostile(3,4)).toBe(false);
  pop.addRespect(-60);
  expect(pop.gangRespect()).toBe(40);
});

test('weak turf stays unarmed while strong turf arms up',async()=>{
  const pop=await import('../src/simulation/nativePopulation');
  expect(pop.gangPartyArmed(3,true,0,10)).toBe(false);
  expect(pop.gangPartyArmed(3,true,0,20)).toBe(true);
  expect(pop.gangPartyArmed(3,false,2,255)).toBe(true);
});
