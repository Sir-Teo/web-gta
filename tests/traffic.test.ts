import { afterEach, beforeAll, expect, test } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Simulation, type Controls } from './helpers/Simulation';
import { captureSave, isSave, restoreSave } from './fixtures/physics-world/saves';
import { trafficControls } from '../src/simulation/traffic';
let sim: Simulation;
const idle: Controls = { x: 0, y: 0, sprint: false, jump: false, handbrake: false, cameraYaw: 0 };
beforeAll(async () => { await RAPIER.init(); });
afterEach(() => sim?.dispose());
function advance(seconds: number) { for (let i = 0; i < seconds * 60; i++) sim.step(1 / 60, idle); }

test('traffic follows both lanes and recycles a fixed population over three minutes', () => {
  sim = new Simulation();
  const cars = sim.vehicles.filter(v => v.traffic);
  for (let second = 0; second < 180; second++) {
    advance(1);
    for (const car of cars) {
      const p = car.body.translation();
      expect(Math.abs(p.z - car.traffic!.laneZ)).toBeLessThan(0.6);
      expect(p.y).toBeGreaterThan(0.4); expect(p.y).toBeLessThan(1.1);
      expect(Math.abs(p.x)).toBeLessThan(221);
    }
  }
  expect(cars.every(v => v.traffic!.cycles > 0)).toBe(true);
  expect(sim.world.bodies.len()).toBe(17);
});

test('traffic brakes for a person in its lane and resumes after clearance', () => {
  sim = new Simulation(); advance(3);
  const car = sim.vehicles[2], start = car.body.translation();
  const block = sim.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(start.x + 16, 0.9, start.z));
  sim.world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.3), block);
  advance(5);
  expect(car.traffic!.state).toBe('brake'); expect(Math.abs(car.controller.currentVehicleSpeed())).toBeLessThan(0.5);
  expect(car.body.translation().x).toBeLessThan(block.translation().x - 3);
  sim.world.removeRigidBody(block); advance(3);
  expect(car.controller.currentVehicleSpeed()).toBeGreaterThan(2);
});

test('claimed traffic cars persist while unclaimed cars remain transient', () => {
  sim = new Simulation(); advance(1);
  expect(captureSave(sim).vehicles).toHaveLength(2);
  const car = sim.vehicles[2], p = car.body.translation();
  car.body.setLinvel({ x: 0, y: 0, z: 0 }, true); car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  const foot = { x: p.x + 0.05, y: p.y - 0.65, z: p.z - 1.7 };
  sim.player.position = { ...foot }; sim.player.previous = { ...foot }; sim.player.grounded = true;
  sim.playerBody.setTranslation({ ...foot, y: foot.y + 0.9 }, true);
  sim.playerBody.setNextKinematicTranslation({ ...foot, y: foot.y + 0.9 });
  expect(sim.interact()).toBe(''); advance(2);
  expect(sim.activeVehicle).toBe(car); expect(car.traffic!.claimed).toBe(true);
  expect(sim.interact()).toBe(''); advance(2); expect(sim.activeVehicle).toBeNull();
  const saved = captureSave(sim); expect(saved.vehicles).toHaveLength(3); expect(isSave(saved)).toBe(true);
  restoreSave(sim, saved); expect(car.traffic!.claimed).toBe(true);
  expect(sim.vehicles[3].traffic!.claimed).toBe(false);
  expect(car.body.translation().x).toBeCloseTo(saved.vehicles[2].position.x, 3);
});


test('loading keeps regenerated traffic clear of the saved player', () => {
  sim = new Simulation(); advance(0.5); const saved = captureSave(sim);
  saved.position = { x: -65, y: 0, z: 164.5 }; restoreSave(sim, saved);
  expect(sim.vehicles.filter(v => v.traffic).every(v => Math.hypot(v.body.translation().x - saved.position.x, v.body.translation().z - saved.position.z) >= 12)).toBe(true);
});

test('traffic brakes immediately for a relocated pedestrian before the next physics step',()=>{
  sim=new Simulation();advance(.5);
  const car=sim.vehicles[2],ped=sim.population.pedestrians[0],p=car.body.translation();
  ped.body.setTranslation({x:p.x+3.2,y:p.y+.35,z:p.z},true);
  sim.world.propagateModifiedBodyPositionsToColliders();
  const blocked=trafficControls(sim.world,car,sim.vehicles,sim.player.position)!;
  expect(blocked.brake).toBeGreaterThan(0);expect(blocked.engine).toBe(0);
  ped.collider.setEnabled(false);
  const clear=trafficControls(sim.world,car,sim.vehicles,sim.player.position)!;
  expect(clear.brake).toBe(0);expect(clear.engine).toBeGreaterThan(0);
});
