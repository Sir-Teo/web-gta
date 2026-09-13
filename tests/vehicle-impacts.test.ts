import { afterEach, beforeAll, expect, test } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Simulation, type Controls } from '../src/simulation/Simulation';
import { captureSave, restoreSave } from '../src/persistence/saves';
let sim: Simulation;
const idle: Controls = { x: 0, y: 0, sprint: false, jump: false, handbrake: false, cameraYaw: 0 };
beforeAll(async () => { await RAPIER.init(); });
afterEach(() => sim?.dispose());
function advance(frames: number, controls = idle) { for (let i = 0; i < frames; i++) sim.step(1 / 60, controls); }
function setup(speed: number, x = 0) {
  sim = new Simulation(); advance(60);
  const saved = captureSave(sim); saved.position = { x: 0, y: 0, z: 40 }; restoreSave(sim, saved); advance(10);
  const car = sim.vehicles[0];
  car.body.setTranslation({ x, y: 0.65, z: 36 }, true);
  car.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  car.body.setLinvel({ x: 0, y: 0, z: speed }, true); car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  return car;
}
test('a physical strike damages and interrupts the player, then allows recovery', () => {
  setup(10);
  for (let i = 0; i < 60 && sim.player.health === 100; i++) advance(1);
  expect(sim.player.health).toBeLessThan(100); expect(sim.player.health).toBeGreaterThan(0);
  expect(sim.impactRemaining).toBeGreaterThan(0);
  expect(() => captureSave(sim)).toThrow('impact');
  const health = sim.player.health, z = sim.player.position.z;
  advance(15, { ...idle, x: 1, sprint: true, jump: true });
  expect(sim.player.speed).toBe(0); expect(sim.player.position.z).toBeGreaterThan(z);
  expect(sim.player.health).toBe(health);
  advance(45); expect(sim.impactRemaining).toBe(0); expect(sim.player.health).toBe(health);
  expect(() => captureSave(sim)).not.toThrow();
});
test('a fast near miss and walking into a parked car do not damage the player', () => {
  const car = setup(16, 3); advance(45); expect(sim.player.health).toBe(100);
  car.body.setTranslation({ x: 0, y: 0.65, z: 43 }, true);
  car.body.setLinvel({ x: 0, y: 0, z: 0 }, true); car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  advance(90, { ...idle, y: -1, sprint: true }); expect(sim.player.health).toBe(100);
});
test('a fatal vehicle strike uses death recovery and clears impact state', () => {
  setup(20); sim.player.health = 10;
  for (let i = 0; i < 60 && sim.player.health > 0; i++) advance(1);
  expect(sim.player.health).toBe(0); expect(sim.deathRemaining).toBeGreaterThan(0);
  advance(250); expect(sim.player.health).toBe(100); expect(sim.impactRemaining).toBe(0);
});

test('continuous contact is one hit, separating permits another, and tangential motion is harmless', async () => {
  const { VehicleImpacts } = await import('../src/simulation/vehicleImpacts');
  const car = setup(0);
  const impacts = new VehicleImpacts();
  car.body.setTranslation({ x: 0, y: 0.65, z: 37.58 }, true);
  const hit = (velocity: { x: number; y: number; z: number }) => {
    car.body.setLinvel(velocity, true); sim.world.propagateModifiedBodyPositionsToColliders(); impacts.capture([car]);
    return impacts.detect(1 / 60, [car], sim.playerCollider, { x: 0, y: 0, z: 0 });
  };
  expect(hit({ x: 0, y: 0, z: 10 })?.damage).toBeGreaterThan(0);
  for (let frame = 0; frame < 120; frame++) expect(hit({ x: 0, y: 0, z: 10 })).toBeNull();
  car.body.setTranslation({ x: 0, y: 0.65, z: 30 }, true);
  for (let frame = 0; frame < 12; frame++) hit({ x: 0, y: 0, z: 0 });
  car.body.setTranslation({ x: 0, y: 0.65, z: 37.58 }, true);
  expect(hit({ x: 0, y: 0, z: 10 })?.damage).toBeGreaterThan(0);
  impacts.reset(); expect(hit({ x: 15, y: 0, z: 0 })).toBeNull();
});
