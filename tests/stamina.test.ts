import { afterEach, beforeAll, expect, test } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Simulation, type Controls } from './helpers/Simulation';
import { captureSave, isSave, restoreSave } from './fixtures/physics-world/saves';
let sim: Simulation;
const running: Controls = { x: 0, y: -1, sprint: true, jump: false, handbrake: false, cameraYaw: 0 };
beforeAll(async () => { await RAPIER.init(); });
afterEach(() => sim?.dispose());
function advance(frames: number, controls = running) { for (let i = 0; i < frames; i++) sim.step(1 / 60, controls); }

test('held sprint recovers steadily after exhaustion before allowing another burst', () => {
  sim = new Simulation(); sim.player.stamina = 0.1;
  advance(1); expect(sim.player.stamina).toBe(0); expect(sim.player.sprintExhausted).toBe(true);
  for (let frame = 0; frame < 120; frame++) {
    const stamina = sim.player.stamina; advance(1);
    expect(sim.player.stamina).toBeGreaterThan(stamina);
    expect(sim.player.sprintExhausted).toBe(true);
  }
  expect(sim.player.speed).toBeCloseTo(3.7, 3);
  advance(40); expect(sim.player.sprintExhausted).toBe(false);
  expect(sim.player.speed).toBeGreaterThan(6);
});

test('stamina and exhaustion survive saves, validate bounds and reset for old saves', () => {
  sim = new Simulation(); sim.player.stamina = 8; sim.player.sprintExhausted = true;
  const saved = captureSave(sim); restoreSave(sim, saved);
  expect(sim.player.stamina).toBe(8); expect(sim.player.sprintExhausted).toBe(true);
  advance(1); expect(sim.player.stamina).toBeGreaterThan(8);
  for (const stamina of [-1, 101, Infinity, NaN, '20']) expect(isSave({ ...saved, stamina })).toBe(false);
  expect(isSave({ ...saved, sprintExhausted: 1 })).toBe(false);
  delete saved.stamina; delete saved.sprintExhausted; restoreSave(sim, saved);
  expect(sim.player.stamina).toBe(100); expect(sim.player.sprintExhausted).toBe(false);
  sim.player.stamina = 0; sim.player.sprintExhausted = true; sim.resetPlayer();
  expect(sim.player.stamina).toBe(100); expect(sim.player.sprintExhausted).toBe(false);
});
