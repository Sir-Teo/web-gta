import { afterEach, beforeAll, expect, test } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Simulation, type Controls } from './helpers/groundedSimulation';
let sim: Simulation;
const running: Controls = { x: 0, y: -1, sprint: true, jump: false, cameraYaw: 0 };
beforeAll(async () => { await RAPIER.init(); });
afterEach(() => sim?.dispose());
function advance(frames: number, controls = running) { for (let i = 0; i < frames; i++) sim.step(1 / 60, controls); }

test('held sprint reaches the native negative floor, recovers while running and restarts once its budget is positive', () => {
  sim = new Simulation(); sim.player.stamina = 0.1;sim.player.moveBlend=1.8;
  advance(1); expect(sim.player.stamina).toBeLessThan(0); expect(sim.player.sprintExhausted).toBe(false);
  let floor=false;
  for(let frame=0;frame<360;frame++){advance(1);floor||=sim.player.stamina===-150;expect(sim.player.stamina).toBeGreaterThanOrEqual(-150);}
  expect(floor).toBe(true);expect(sim.player.sprintExhausted).toBe(true);expect(sim.player.stamina).toBeLessThan(0);
  expect(sim.player.speed).toBeCloseTo(5.706, 3);
  const idle={...running,x:0,y:0,sprint:false};
  for(let i=0;i<1000&&sim.player.stamina<=0;i++)advance(1,idle);
  expect(sim.player.stamina).toBeGreaterThan(0);expect(sim.player.stamina).toBeLessThan(1);
  advance(1);expect(sim.footMove).toBe('sprint');expect(sim.player.sprintExhausted).toBe(false);
});
