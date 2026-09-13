import { afterEach, beforeAll, expect, test } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Simulation, type Controls } from '../src/simulation/Simulation';
import { captureSave, isSave, restoreSave } from '../src/persistence/saves';
let sim: Simulation;
const idle: Controls = { x: 0, y: 0, sprint: false, jump: false, handbrake: false, cameraYaw: 0 };
beforeAll(async () => { await RAPIER.init(); });
afterEach(() => sim?.dispose());
function advance(seconds: number, controls = idle) { for (let i = 0; i < seconds * 60; i++) sim.step(1 / 60, controls); }
function drop(height: number) {
  sim.playerBody.setTranslation({ x: 0, y: height + 0.9, z: 0 }, true);
  sim.playerBody.setNextKinematicTranslation({ x: 0, y: height + 0.9, z: 0 });
  sim.player.position = { x: 0, y: height, z: 0 }; sim.player.grounded = false; sim.player.verticalSpeed = 0;
}

test('ordinary jumps are safe, while a high fall damages health once', () => {
  sim = new Simulation(); advance(0.5); advance(1 / 60, { ...idle, jump: true }); advance(1.2);
  expect(sim.player.health).toBe(100);
  drop(5); advance(1.1); expect(sim.player.health).toBeGreaterThan(0); expect(sim.player.health).toBeLessThan(90);
  const health = sim.player.health; advance(0.5); expect(sim.player.health).toBe(health);
});

test('fatal falls gate movement and saving until timed recovery', () => {
  sim = new Simulation(); drop(20); advance(1.6);
  expect(sim.player.health).toBe(0); expect(sim.deathRemaining).toBeGreaterThan(0);
  expect(() => captureSave(sim)).toThrow('recovery');
  const position = { ...sim.player.position }; advance(0.5, { ...idle, x: 1, sprint: true, jump: true });
  expect(sim.player.position.x).toBeCloseTo(position.x, 2);
  advance(4); expect(sim.player.health).toBe(100); expect(sim.deathRemaining).toBe(0);
  expect(sim.player.position.x).toBeCloseTo(-3, 2);
});

test('health survives saves while old saves default to full health', () => {
  sim = new Simulation(); sim.player.health = 45;
  const saved = captureSave(sim); restoreSave(sim, saved); expect(sim.player.health).toBe(45);
  expect(isSave({ ...saved, health: 0 })).toBe(false); expect(isSave({ ...saved, health: Infinity })).toBe(false);
  delete saved.health; restoreSave(sim, saved); expect(sim.player.health).toBe(100);
});

test('reset discards old ground contact until physics resolves the destination',()=>{
  sim=new Simulation();advance(.5);expect(sim.player.grounded).toBe(true);
  sim.resetPlayer();expect(sim.player.grounded).toBe(false);
  advance(.2);expect(sim.player.grounded).toBe(true);
  advance(1/60,{...idle,jump:true});expect(sim.player.verticalSpeed).toBeGreaterThan(0);
});

test('restoring an elevated save cannot use ground contact from the previous location to jump',()=>{
  sim=new Simulation();advance(.5);expect(sim.player.grounded).toBe(true);
  const saved=captureSave(sim);saved.position={x:0,y:2,z:0};
  restoreSave(sim,saved);
  expect(sim.playerCollider.translation()).toEqual(sim.playerBody.translation());
  advance(1/60,{...idle,jump:true});
  expect(sim.player.grounded).toBe(false);expect(sim.player.verticalSpeed).toBeLessThan(0);
  expect(sim.player.position.y).toBeLessThan(saved.position.y);
  advance(1);expect(sim.player.grounded).toBe(true);expect(sim.player.health).toBe(100);
});
