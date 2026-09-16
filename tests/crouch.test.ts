import { afterEach, beforeAll, expect, test } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Simulation, type Controls } from './helpers/groundedSimulation';
let sim: Simulation;
const idle: Controls = { x: 0, y: 0, sprint: false, jump: false, cameraYaw: 0 };
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
  // 1.4 m clearance admits the 1.3 m crouched capsule, but not standing.
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(1, 0.15, 1).setTranslation(p.x, p.y + 1.55, p.z - 2));
  // Walk (Alt) for the standing check: native run (5.7 m/s) would slam the
  // wall harder than the authored 3.7 the original clearance was tuned for.
  advance(0.8, { ...idle, y: 1, walk: true });
  expect(sim.player.position.z).toBeGreaterThan(p.z - 1);
  sim.toggleCrouch(); advance(1.1, { ...idle, y: 1 }); advance(0.2);
  expect(sim.player.position.z).toBeLessThan(p.z - 1.2);
  expect(sim.toggleCrouch()).toContain('not enough room'); expect(sim.player.crouched).toBe(true);
  advance(1.7, { ...idle, y: 1 });
  expect(sim.toggleCrouch()).toBe(''); expect(sim.player.crouched).toBe(false);
});

test('stance changes update the query collider before the next movement sweep',()=>{
  sim=new Simulation();advance(.5);expect(sim.player.grounded).toBe(true);
  for(let i=0;i<10;i++){
    const feet=sim.player.position.y;
    sim.toggleCrouch();expect(sim.player.crouched).toBe(true);
    expect(sim.playerCollider.translation()).toEqual(sim.playerBody.translation());
    advance(1/60);expect(sim.player.grounded).toBe(true);
    sim.toggleCrouch();expect(sim.player.crouched).toBe(false);
    expect(sim.playerCollider.translation()).toEqual(sim.playerBody.translation());
    advance(1/60);expect(sim.player.grounded).toBe(true);expect(Math.abs(sim.player.position.y-feet)).toBeLessThan(.001);
  }
});
