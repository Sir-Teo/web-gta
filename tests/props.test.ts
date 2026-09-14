import { afterEach, beforeAll, expect, test } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Simulation, type Controls } from './helpers/Simulation';
import { solids } from './fixtures/physics-world/layout';

let sim: Simulation;
const idle: Controls = { x: 0, y: 0, sprint: false, jump: false, handbrake: false, cameraYaw: 0 };
beforeAll(async () => { await RAPIER.init(); });
afterEach(() => sim?.dispose());
function advance(seconds: number, controls = idle) { for (let i = 0; i < seconds * 60; i++) sim.step(1 / 60, controls); }
function place(x: number, y: number, z: number) {
  const center = { x, y: y + 0.9, z };
  sim.playerBody.setTranslation(center, true); sim.playerBody.setNextKinematicTranslation(center);
  sim.player.position = { x, y, z }; sim.player.previous = { x, y, z }; sim.player.speed = 0; sim.player.verticalSpeed = 0;
  advance(0.1);
}
test('street entrance stays open while poles and bridge parapets have collision', () => {
  sim = new Simulation(); advance(0.2);
  expect(new Set(solids.map(s => s.id)).size).toBe(solids.length);
  expect(sim.world.castRay(new RAPIER.Ray({ x: 0, y: 0.15, z: 12 }, { x: 0, y: 0, z: 1 }), 10, true)).toBeNull();
  for (const id of ['utility-pole-0', 'street-lamp-0', 'palm-0', 'bridge-parapet-107.6']) {
    const collider = sim.staticColliders.get(id)!; const p = collider.translation();
    const hit = sim.world.castRay(new RAPIER.Ray({ x: p.x, y: p.y, z: p.z - 2 }, { x: 0, y: 0, z: 1 }), 4, true,
      undefined, undefined, undefined, undefined, c => c.handle === collider.handle);
    expect(hit?.collider.handle).toBe(collider.handle);
  }
});
test('a fence stops a walking character and a moving car', () => {
  sim = new Simulation(); advance(0.5);
  const fence = sim.staticColliders.get('north/fence--1')!.translation();
  place(fence.x + 2, 0, fence.z); advance(1.2, { ...idle, x: -1 });
  expect(sim.player.position.x).toBeGreaterThan(fence.x + 0.32);
  expect(sim.player.position.x).toBeLessThan(fence.x + 0.55);
  sim.resetPlayer();
  const car = sim.vehicles[0];
  car.body.setTranslation({ x: fence.x + 3, y: 0.7, z: fence.z }, true);
  car.body.setLinvel({ x: -8, y: 0, z: 0 }, true);
  advance(0.6);
  expect(car.body.translation().x).toBeGreaterThan(fence.x + 0.6);
  expect(car.body.linvel().x).toBeGreaterThan(-3);
});
test('porch steps support the character at the rendered platform height', () => {
  sim = new Simulation(); place(-3, 0, -21.5);
  advance(0.85, { ...idle, y: 1 });
  expect(sim.player.position.z).toBeLessThan(-23.5);
  const porch=solids.find(s=>s.id==='north/porch')!;
  expect(sim.player.position.y).toBeCloseTo(porch.y+porch.hy+.025,3);
  expect(sim.player.grounded).toBe(true);
});
test('the pitched roof supports a falling character above the wall collider', () => {
  sim = new Simulation(); place(-3, 7, -31); advance(2);
  expect(sim.player.position.y).toBeGreaterThan(4.9);
  expect(sim.player.position.y).toBeLessThan(5.3);
  expect(sim.player.grounded).toBe(true);
});

test('walks up and across a raised sidewalk from the road', () => {
  sim = new Simulation(); place(5, 0, 70); advance(1.5, { ...idle, x: 1 });
  expect(sim.player.position.x).toBeGreaterThan(9);
});


test('all follow distances shorten before a wall and recover in open space', () => {
  sim = new Simulation(); advance(0.2);
  for (const distance of [2.8, 4.8, 6.4, 5.2, 7.2, 9.4]) {
    const blocked = sim.cameraDistance({ x: -3, y: 1.3, z: -24 }, { x: 0, y: 0, z: -1 }, distance);
    expect(blocked).toBeGreaterThan(1); expect(blocked).toBeLessThan(2);
    expect(sim.cameraDistance({ x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: 1 }, distance)).toBe(distance);
  }
});
