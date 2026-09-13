import { afterEach, beforeAll, expect, test } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Simulation, type Controls } from '../src/simulation/Simulation';
import { captureSave, isSave, restoreSave } from '../src/persistence/saves';
let sim: Simulation;
const idle: Controls = { x: 0, y: 0, sprint: false, jump: false, handbrake: false, cameraYaw: 0 };
beforeAll(async () => { await RAPIER.init(); });
afterEach(() => sim?.dispose());
function advance(seconds: number, controls = idle) { for (let i = 0; i < seconds * 60; i++) sim.step(1 / 60, controls); }

test('crouching preserves foot height, limits movement and prevents sprint/jump', () => {
  sim = new Simulation(); advance(0.5); const start = { ...sim.player.position };
  sim.toggleCrouch(); advance(0.2);
  expect(sim.player.crouched).toBe(true); expect(Math.abs(sim.player.position.y - start.y)).toBeLessThan(0.025);
  advance(1, { ...idle, y: 1, sprint: true, jump: true });
  expect(sim.player.speed).toBeCloseTo(1.4, 1); expect(sim.player.stamina).toBe(100);
  expect(Math.abs(sim.player.position.y - start.y)).toBeLessThan(0.025); expect(sim.player.grounded).toBe(true);
  sim.toggleCrouch(); advance(0.2); expect(sim.player.crouched).toBe(false);
  expect(Math.abs(sim.player.position.y - start.y)).toBeLessThan(0.025);
});

test('a low overhang permits crouched traversal but blocks standing until clear', () => {
  sim = new Simulation(); advance(0.5);
  const p = sim.player.position;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(1, 0.15, 1).setTranslation(p.x, 1.35, p.z - 2));
  advance(0.8, { ...idle, y: 1 });
  expect(sim.player.position.z).toBeGreaterThan(p.z - 1);
  sim.toggleCrouch(); advance(1.1, { ...idle, y: 1 }); advance(0.2);
  expect(sim.player.position.z).toBeLessThan(p.z - 1.2);
  expect(sim.toggleCrouch()).toContain('not enough room'); expect(sim.player.crouched).toBe(true);
  advance(1.7, { ...idle, y: 1 });
  expect(sim.toggleCrouch()).toBe(''); expect(sim.player.crouched).toBe(false);
});

test('saves preserve crouched stance and accept older saves without a stance field', () => {
  sim = new Simulation(); advance(0.5); sim.toggleCrouch(); const saved = captureSave(sim);
  sim.resetPlayer(); restoreSave(sim, saved); advance(0.2);
  expect(sim.player.crouched).toBe(true); expect(sim.player.position.y).toBeCloseTo(saved.position.y, 2);
  expect(isSave({ ...saved, crouched: 'yes' })).toBe(false);
  delete saved.crouched; expect(isSave(saved)).toBe(true); restoreSave(sim, saved);
  expect(sim.player.crouched).toBe(false);
});
