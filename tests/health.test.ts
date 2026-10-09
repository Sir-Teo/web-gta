import { afterEach, beforeAll, expect, test } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Simulation, type Controls } from './helpers/groundedSimulation';
let sim: Simulation;
const idle: Controls = { x: 0, y: 0, sprint: false, jump: false, cameraYaw: 0 };
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
  // Five units: in FALL_FALL but under 0.375 units a frame, the ped collision's 15 (landingDamage), through the
  // player's damage multiplier.
  drop(5); advance(1.1); const five = 100 - sim.player.health; expect(five).toBeGreaterThan(0); expect(five).toBeLessThan(15);
  advance(0.5); expect(sim.player.health).toBe(100 - five);
  // Twelve: past the gate, (−0.25 − down) × 400, much more, once.
  sim.player.health = 100; drop(12); advance(1.5); const twelve = 100 - sim.player.health;
  expect(twelve).toBeGreaterThan(five * 2); expect(sim.player.health).toBeGreaterThan(0);
  advance(0.5); expect(sim.player.health).toBe(100 - twelve);
});

test('reset discards old ground contact until physics resolves the destination',()=>{
  sim=new Simulation();advance(.5);expect(sim.player.grounded).toBe(true);
  sim.resetPlayer();expect(sim.player.grounded).toBe(false);
  advance(.2);expect(sim.player.grounded).toBe(true);
  advance(1/60,{...idle,jump:true});expect(sim.player.verticalSpeed).toBeGreaterThan(0);
});

test('ordinary damage kills below one HP and dead-player hits do not restart respawn',()=>{
 sim=new Simulation();sim.player.health=1.1;
 sim.damagePlayer(1,true); // current stat adapter supplies 0.4 damage: leaves < 1 HP
 expect(sim.player.health).toBe(0);
 sim.advancePlayerDeath(.5);const remaining=sim.deathRemaining;
 sim.damagePlayer(100,true);
 expect(sim.deathRemaining).toBe(remaining);
});

test('exactly one HP survives, and vehicle death bypasses damage scaling and armour',()=>{
 sim=new Simulation();sim.player.health=3;sim.damagePlayer(5,true);
 expect(sim.player.health).toBe(1);
 sim.player.armour=100;sim.vehicleOccupantDied();
 expect(sim.player.health).toBe(0);expect(sim.player.armour).toBe(100);
 sim.advancePlayerDeath(.5);const remaining=sim.deathRemaining;
 sim.vehicleOccupantDied();expect(sim.deathRemaining).toBe(remaining);
});
