import { beforeAll, afterEach, expect, test } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Simulation, type Controls } from '../src/simulation/Simulation';
import { captureSave } from '../src/persistence/saves';

const idle: Controls = { x: 0, y: 0, sprint: false, jump: false, handbrake: false, cameraYaw: 0 };
let sim: Simulation;
beforeAll(async () => { await RAPIER.init(); });
afterEach(() => sim?.dispose());
function advance(seconds: number, controls = idle) { for (let i = 0; i < seconds * 60; i++) sim.step(1 / 60, controls); }
function atDoor() {
  sim = new Simulation(); advance(1);
  const p = sim.vehicles[0].body.translation();
  const foot = { x: p.x - 1.7, y: p.y - 0.74, z: p.z - 0.05 };
  const center = { ...foot, y: foot.y + 0.9 };
  sim.playerBody.setTranslation(center, true); sim.playerBody.setNextKinematicTranslation(center);
  sim.player.position = foot; advance(0.1);
}
test('entry and exit take simulation time, gate controls, and restore foot collisions', () => {
  atDoor(); expect(sim.interact()).toBe(''); expect(sim.activeVehicle).toBeNull();
  expect(() => captureSave(sim)).toThrow('Finish getting');
  const start = sim.vehicles[0].body.translation();
  advance(0.6, { ...idle, y: 1 });
  expect(sim.transition?.phase).toBe('transfer');
  expect(sim.vehicles[0].door).toBe(1); expect(sim.seated).toBeGreaterThan(0);
  expect(sim.activeVehicle).toBeNull();
  expect(Math.hypot(sim.vehicles[0].body.translation().x - start.x, sim.vehicles[0].body.translation().z - start.z)).toBeLessThan(0.1);
  advance(1); expect(sim.activeVehicle?.id).toBe('greenwood'); expect(sim.transition).toBeNull();
  expect(sim.playerBody.isEnabled()).toBe(false); expect(sim.seated).toBe(1);
  sim.interact(); advance(0.6); expect(sim.activeVehicle).not.toBeNull();
  advance(1); expect(sim.activeVehicle).toBeNull(); expect(sim.transition).toBeNull();
  expect(sim.playerBody.isEnabled()).toBe(true); expect(sim.seated).toBe(0);
  expect(sim.vehicles[0].door).toBe(0); expect(sim.player.position.y).toBeGreaterThan(-0.2);
});
test('refuses moving or blocked vehicles and permits cancelling the approach', () => {
  atDoor();
  sim.vehicles[0].body.setLinvel({ x: 3, y: 0, z: 0 }, true);
  expect(sim.interact()).toContain('Stop the car'); expect(sim.transition).toBeNull();
  sim.vehicles[0].body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  const p = sim.player.position;
  const wall = sim.world.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 1.5, 1).setTranslation(p.x - 0.2, 1.5, p.z));
  sim.world.step();
  expect(sim.interact()).toContain('blocked');
  sim.world.removeCollider(wall, true); sim.world.step();
  sim.interact(); expect(sim.transition?.phase).toBe('approach'); sim.interact();
  expect(sim.transition).toBeNull(); expect(sim.playerBody.isEnabled()).toBe(true);
});

test('a relocated resident blocks the door before physics updates the spatial index',()=>{
  atDoor();const ped=sim.population.pedestrians[0];
  ped.body.setTranslation(sim.playerBody.translation(),true);
  sim.world.propagateModifiedBodyPositionsToColliders();
  expect(sim.interact()).toContain('blocked');expect(sim.transition).toBeNull();
  ped.collider.setEnabled(false);
  expect(sim.interact()).toBe('');expect(sim.transition?.phase).toBe('approach');
});
test('reset during a transfer clears the door, seat and interaction state', () => {
  atDoor(); sim.interact(); advance(0.6); expect(sim.seated).toBeGreaterThan(0);
  sim.resetPlayer(); expect(sim.transition).toBeNull(); expect(sim.activeVehicle).toBeNull();
  expect(sim.seated).toBe(0); expect(sim.vehicles[0].door).toBe(0); expect(sim.playerBody.isEnabled()).toBe(true);
});
test('a vehicle pushed during entry aborts safely and a pushed exit keeps the driver seated', () => {
  atDoor(); sim.interact(); advance(0.6);
  sim.vehicles[0].body.setLinvel({ x: 3, y: 0, z: 0 }, true); advance(1 / 60);
  expect(sim.transition).toBeNull(); expect(sim.activeVehicle).toBeNull();
  expect(sim.playerBody.isEnabled()).toBe(true); expect(sim.vehicles[0].door).toBe(0);
  sim.vehicles[0].body.setLinvel({ x: 0, y: 0, z: 0 }, true); advance(0.2);
  sim.interact(); advance(2); expect(sim.activeVehicle).not.toBeNull();
  sim.interact(); advance(0.6);
  sim.vehicles[0].body.setLinvel({ x: 3, y: 0, z: 0 }, true); advance(1 / 60);
  expect(sim.transition).toBeNull(); expect(sim.activeVehicle?.id).toBe('greenwood');
  expect(sim.playerBody.isEnabled()).toBe(false); expect(sim.seated).toBe(1);
});
test('repeated interaction cannot interrupt a transfer and an obstructed exit stays seated', () => {
  atDoor(); sim.interact(); advance(0.6);
  expect(sim.interact()).toContain('Wait until'); expect(sim.transition?.phase).toBe('transfer');
  advance(1);
  const p = sim.vehicles[0].body.translation();
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 1.5, 1).setTranslation(p.x - 1.8, 1.5, p.z));
  sim.world.step();
  expect(sim.interact()).toContain('blocked'); expect(sim.transition).toBeNull();
  expect(sim.activeVehicle?.id).toBe('greenwood'); expect(sim.playerBody.isEnabled()).toBe(false);
});
