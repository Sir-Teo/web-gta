import { beforeAll, expect, test } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Progression } from '../src/simulation/Progression';
import { Simulation } from '../src/simulation/Simulation';
import { WeaponInventory } from '../src/weapons/Inventory';
beforeAll(async () => { await RAPIER.init(); });
function setup() {
 const sim = new Simulation(), inv = new WeaponInventory();
 const p = new Progression(inv, sim);
 sim.player.position = { x: 8, y: 0, z: -25 };
 return { sim, inv, p };
}
test('mission chain unlocks sequentially with reach, kill, drive, hit and collect objectives', () => {
 const { sim, p } = setup();
 try {
  expect(p.currentMission()?.id).toBe('grove-intro');
  p.missionUpdate();
  expect(p.currentMission()?.id).toBe('grove-defense');
  // Wrong gang does not count; rivals do.
  p.recordKill(1); p.recordKill(5);
  expect(p.missionProgress()).toEqual({ done: 0, total: 3 });
  p.recordKill(0); p.recordKill(0); p.recordKill(2);
  p.missionUpdate();
  expect(p.currentMission()?.id).toBe('wheelman');
  // Drive objective measures from unlock (shuttle near the marker).
  let dir = 1;
  for (let i = 0; i < 1600; i++) { sim.player.position.x += dir; if (i % 25 === 24) dir = -dir; p.tick(1 / 60, true, 0, false); }
  expect(p.currentMission()?.id).toBe('marksman');
  for (let i = 0; i < 15; i++) p.hit(30);
  p.missionUpdate();
  expect(p.currentMission()?.id).toBe('collector');
  for (let i = 0; i < 5; i++) p.recordCollect('horseshoe');
  p.missionUpdate();
  expect(p.currentMission()).toBeUndefined();
  expect(p.missions.every(m => m.done)).toBe(true);
 } finally { sim.dispose(); }
});
test('mission progress requires standing at the marker', () => {
 const { sim, p } = setup();
 try {
  sim.player.position = { x: 500, y: 0, z: 500 };
  p.recordKill(0); p.recordKill(0); p.recordKill(0);
  p.missionUpdate(); // intro not reached
  expect(p.currentMission()?.id).toBe('grove-intro');
 } finally { sim.dispose(); }
});
