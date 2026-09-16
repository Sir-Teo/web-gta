import { afterEach, beforeAll, expect, test } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Simulation, type Controls } from './helpers/groundedSimulation';
let sim: Simulation;
const running: Controls = { x: 0, y: -1, sprint: true, jump: false, cameraYaw: 0 };
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
  expect(sim.player.speed).toBeCloseTo(5.706, 3);
  advance(40); expect(sim.player.sprintExhausted).toBe(false);
  // Damped sprint converges toward native 9.562; 40 frames reaches ~8.9.
  expect(sim.player.speed).toBeGreaterThan(8.5);
});
