import { afterEach, beforeAll, expect, test } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Simulation, type Controls } from '../src/simulation/Simulation';
import { nearestSidewalk, sidewalkPoint } from '../src/world/sidewalks';
import { captureSave, restoreSave } from '../src/persistence/saves';

let sim: Simulation;
const idle: Controls = { x: 0, y: 0, sprint: false, jump: false, handbrake: false, cameraYaw: 0 };
beforeAll(async () => { await RAPIER.init(); });
afterEach(() => sim?.dispose());
function advance(seconds: number) { for (let i = 0; i < seconds * 60; i++) sim.step(1 / 60, idle); }

test('residents stay grounded, avoid overlap and traverse the sidewalk over two minutes', () => {
  sim = new Simulation();
  const initial = sim.population.pedestrians.map(p => ({ ...p.position }));
  let sawIdle = false, minSeparation = Infinity, maxCorridorOffset = 0;
  for (let second = 0; second < 120; second++) {
    advance(1);
    const peds = sim.population.pedestrians;
    for (let i = 0; i < peds.length; i++) {
      expect(peds[i].position.y).toBeGreaterThan(-0.2);
      // Residents may step onto the newly physical 20 cm curbs.
      expect(peds[i].position.y).toBeLessThan(0.3);
      maxCorridorOffset = Math.max(maxCorridorOffset, nearestSidewalk(peds[i].position).separation);
      sawIdle ||= peds[i].state === 'idle';
      for (let j = i + 1; j < peds.length; j++) minSeparation = Math.min(minSeparation,
        Math.hypot(peds[i].position.x - peds[j].position.x, peds[i].position.z - peds[j].position.z));
    }
  }
  expect(sawIdle).toBe(true); expect(minSeparation).toBeGreaterThan(0.5); expect(maxCorridorOffset).toBeLessThan(1.8);
  expect(sim.population.pedestrians.every((p, i) => Math.hypot(p.position.x - initial[i].x, p.position.z - initial[i].z) > 5)).toBe(true);
  expect(sim.world.bodies.len()).toBe(17);
});

test('an approaching car causes lateral evasion, then the pedestrian returns to the corridor', () => {
  sim = new Simulation(); advance(0.5);
  // Use the straight sidewalk; the old approach through the cul-de-sac garden now hits its fence.
  const ped = sim.population.pedestrians[4], start = { ...ped.position }, car = sim.vehicles[0];
  car.body.setTranslation({ x: start.x, y: 0.7, z: start.z - 8 }, true);
  car.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  car.body.setLinvel({ x: 0, y: 0, z: 8 }, true);
  advance(0.25); expect(ped.state).toBe('flee');
  advance(0.5); expect(Math.abs(ped.position.x - start.x)).toBeGreaterThan(1);
  car.body.setTranslation({ x: 0, y: 0.7, z: 100 }, true); car.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  advance(10); expect(ped.state).not.toBe('flee'); expect(nearestSidewalk(ped.position).separation).toBeLessThan(1.3);
});

test('a stationary vehicle blocks a walk without making the resident wait forever', () => {
  sim = new Simulation(); advance(0.5);
  const ped = sim.population.pedestrians[4];
  const near = nearestSidewalk(ped.position), obstacle = sidewalkPoint(near.distance + ped.direction * 2.2);
  sim.vehicles[0].body.setTranslation({ ...obstacle, y: 0.7 }, true);
  const startDirection = ped.direction;
  advance(0.3); expect(ped.state).toBe('yield');
  advance(3); expect(ped.direction).toBe(-startDirection); expect(ped.state).toBe('walk');
});

test('loading regenerates transient residents away from the restored player and cars', () => {
  sim = new Simulation(); advance(1); const save = captureSave(sim);
  save.position = { ...sim.population.pedestrians[0].position };
  restoreSave(sim, save);
  expect(sim.population.pedestrians.every(p => Math.hypot(p.position.x - save.position.x, p.position.z - save.position.z) >= 3.5)).toBe(true);
  expect(sim.population.pedestrians.every(p => p.state === 'walk' && p.speed === 0)).toBe(true);
  expect(sim.world.bodies.len()).toBe(17);
});

test('reset residents sweep from their new position before the next physics step', () => {
  sim = new Simulation(); advance(0.5);
  const ped = sim.population.pedestrians[0];
  ped.body.setTranslation({ x: 70, y: 20, z: 40 }, true);
  sim.world.step();
  sim.population.reset([]);
  const center = ped.body.translation();
  expect(ped.collider.translation()).toEqual(center);
  // The old airborne collider would allow this sweep to fall through the sidewalk.
  ped.controller.computeColliderMovement(ped.collider, { x: 0, y: -2, z: 0 });
  expect(ped.controller.computedGrounded()).toBe(true);
  expect(ped.controller.computedMovement().y).toBeGreaterThan(-0.5);
});
