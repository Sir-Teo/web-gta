import { expect, test } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import { hoverFlight } from '../src/simulation/hoverFlight';
import { WorldPolice } from '../src/simulation/WorldPolice';
import { heliHeading, heliOrbitPoint, helisRequired, policeHeliInputs, rappelWindow, HELI_HOVER_HEIGHT, HELI_ORBIT_RADIUS } from '../src/simulation/policeHeli';

test('heli backup follows the native star schedule', () => {
  expect(helisRequired(0)).toBe(0);
  expect(helisRequired(2)).toBe(0);
  expect(helisRequired(3)).toBe(1);
  expect(helisRequired(4)).toBe(2);
  expect(helisRequired(6)).toBe(2);
});

test('rappel needs five stars, a fresh cooldown and a low airframe nearby', () => {
  const ready = { level: 5, sinceRappel: 61, lateral: 40, altitude: 20 };
  expect(rappelWindow(ready)).toBe(true);
  expect(rappelWindow({ ...ready, level: 4 })).toBe(false);
  expect(rappelWindow({ ...ready, sinceRappel: 30 })).toBe(false);
  expect(rappelWindow({ ...ready, lateral: 90 })).toBe(false);
  expect(rappelWindow({ ...ready, altitude: 50 })).toBe(false);
  expect(rappelWindow({ ...ready, altitude: 5 })).toBe(false);
});
test('hover orbit holds above a stationary suspect', () => {
  const suspect = { x: 60, y: 10, z: -40 };
  expect(heliOrbitPoint(suspect, 0)).toEqual({ x: 60 + HELI_ORBIT_RADIUS, y: 10 + HELI_HOVER_HEIGHT, z: -40 });
});

test('a low five-star airframe grounds a two-officer stick', async () => {
  await RAPIER.init();
  const sim = { player: { position: { x: 0, y: 0, z: 0 } }, world: { castRay: () => null }, playerCollider: {} } as any;
  const orbiter = { health: 1, occupied: false, autopilot: undefined, body: { translation: () => ({ x: 10, y: 30, z: 10 }), linvel: () => ({ x: 0, y: 0, z: 0 }), rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }) } } as any;
  const fleet = { planes: new Set([orbiter]), spawnPlane: async () => { throw new Error('no pad'); } } as any;
  const police = new WorldPolice(sim, fleet, { level: 5, native: { helisRequired: 2 } } as any, {} as any, 'http://invalid/', () => 0);
  police.helis.push(orbiter);
  const sticks: unknown[][] = [];
  police.spawnOfficer = ((...args: unknown[]) => { sticks.push(args); }) as any;
  (police as any).seconds = 100;
  (police as any).updateHelis(undefined);
  expect(sticks).toHaveLength(2);
  expect(sticks[0][0]).toBe('swat');
  // A second step inside the cooldown inserts nobody new.
  (police as any).updateHelis(undefined);
  expect(sticks).toHaveLength(2);
  expect(orbiter.autopilot?.brake).toBe(false);
});
test('the pursuit controller closes to a stable hover', () => {
  const pos = new Vector3(0, 40, 0), vel = new Vector3(), quat = new Quaternion();
  const suspect = new Vector3(60, 10, -40);
  const dt = 1 / 60;
  for (let i = 0; i < 60 * 25; i++) {
    const target = heliOrbitPoint({ x: suspect.x, y: suspect.y, z: suspect.z }, i * dt);
    const inputs = policeHeliInputs({ position: { x: pos.x, y: pos.y, z: pos.z }, velocity: { x: vel.x, y: vel.y, z: vel.z }, heading: heliHeading(quat) }, target);
    const result = hoverFlight({ x: vel.x, y: vel.y, z: vel.z }, { x: quat.x, y: quat.y, z: quat.z, w: quat.w }, inputs);
    vel.addScaledVector(result.acceleration, dt);
    pos.addScaledVector(vel, dt);
    const spin = new Quaternion(result.angular.x * dt / 2, result.angular.y * dt / 2, result.angular.z * dt / 2, 1).normalize();
    quat.copy(spin.multiply(quat).normalize());
    expect(Number.isFinite(pos.x + pos.y + pos.z)).toBe(true);
  }
  const flat = Math.hypot(pos.x - suspect.x, pos.z - suspect.z);
  expect(flat).toBeLessThan(HELI_ORBIT_RADIUS + 12);
  expect(Math.abs(pos.y - (suspect.y + HELI_HOVER_HEIGHT))).toBeLessThan(6);
  expect(vel.length()).toBeLessThan(6);
});
test('a police helicopter freed by a vehicle clear-out is never read again', async () => {
  await RAPIER.init();
  const sim = { player: { position: { x: 0, y: 0, z: 0 } }, world: { castRay: () => null }, playerCollider: {} } as any;
  // A freed Rapier body panics when read.
  const freed = { disposed: true, health: 1000, occupied: false, body: { translation: () => { throw new Error('freed body'); } } } as any;
  const fleet = { planes: new Set(), spawnPlane: async () => { throw new Error('no pad'); } } as any;
  const police = new WorldPolice(sim, fleet, { level: 4, native: { helisRequired: 2 } } as any, {} as any, 'http://invalid/', () => 0);
  police.helis.push(freed);
  expect(police.heliActive).toBe(false);
  expect(police.presence({ x: 0, y: 0, z: 0 }, 1000)).toBe(0);
});
test('a helicopter the police let go of takes its searchlight with it', async () => {
  await RAPIER.init();
  const sim = { player: { position: { x: 0, y: 0, z: 0 } }, world: { castRay: () => null }, playerCollider: {} } as any;
  const freed = { disposed: true, health: 1000, occupied: false } as any;
  const fleet = { planes: new Set(), spawnPlane: async () => { throw new Error('no pad'); } } as any;
  const police = new WorldPolice(sim, fleet, { level: 4, native: { helisRequired: 2 } } as any, {} as any, 'http://invalid/', () => 0);
  police.helis.push(freed);police.searchlights.set(freed, { locked: true, illuminated: true, distance: 10 });
  police.dropLostHelis();
  expect(police.helis).toHaveLength(0);
  expect(police.searchlights.size).toBe(0);
});
