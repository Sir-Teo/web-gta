import { expect, test } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { applyGravityAndAirResistance, heliFlyingControl, type FlyingBody } from '../src/simulation/nativeFlyingControl';
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
// POLMAV's flying handling line.
const POLMAV = { thrust: .6, thrustFallOff: .75, yaw: -.0005, yawStabilization: .005, sideSlip: .03, roll: .001, rollStabilization: 1.5, pitch: .001, pitchStabilization: 1.5,
  formLift: .6, attackLift: .002, gearUpResistance: .2, gearDownLift: 1, windMultiplier: .2, moveResistance: .9985, turnResistanceX: .992, turnResistanceY: .992, turnResistanceZ: .996,
  speedResistanceX: .5, speedResistanceY: .5, speedResistanceZ: 10 };
test('the pursuit controller flies a POLMAV on FlyingControl to a stable hover over the suspect', () => {
  // Native axes and units: the heli's basis, position, and move and turn speeds a 50 Hz step.
  type N = [number, number, number];
  const cross = (a: N, b: N): N => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a: N): N => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
  let R: N = [1, 0, 0], F: N = [0, 1, 0], U: N = [0, 0, 1], pos: N = [0, 0, 40], move: N = [0, 0, 0], spin: N = [0, 0, 0];
  const suspect = { x: 60, y: 10, z: -40 }, dt = 1 / 60, ts = dt * 50;
  for (let i = 0; i < 60 * 30; i++) {
    const target = heliOrbitPoint(suspect, i * dt);
    const inputs = policeHeliInputs({ position: { x: pos[0], y: pos[2], z: -pos[1] }, velocity: { x: move[0] * 50, y: move[2] * 50, z: -move[1] * 50 }, heading: Math.atan2(-F[0], F[1]) }, target);
    const body: FlyingBody = { moveSpeed: move, turnSpeed: spin, position: pos, right: R, forward: F, up: U, comWorld: [0, 0, 0], tailY: -6, allWheelsInAir: true, gearStatus: 0 };
    applyGravityAndAirResistance(body, .2 / 2000, ts);
    heliFlyingControl(body, POLMAV, { yaw: inputs.rudder, pitch: inputs.pitch, roll: -inputs.roll, accel: inputs.throttle }, 6, ts);
    move = body.moveSpeed; spin = body.turnSpeed;
    pos = [pos[0] + move[0] * ts, pos[1] + move[1] * ts, pos[2] + move[2] * ts];
    const turn = (a: N): N => { const d = cross(spin, a); return [a[0] + d[0] * ts, a[1] + d[1] * ts, a[2] + d[2] * ts]; };
    F = norm(turn(F)); U = norm(cross(norm(turn(R)), F)); R = norm(cross(F, U));
    expect(Number.isFinite(pos[0] + pos[1] + pos[2])).toBe(true);
  }
  // In the browser's axes the suspect is at (60, 10, −40): native (60, 40, 10).
  expect(Math.hypot(pos[0] - 60, pos[1] - 40)).toBeLessThan(HELI_ORBIT_RADIUS + 12);
  expect(Math.abs(pos[2] - (10 + HELI_HOVER_HEIGHT))).toBeLessThan(6);
  expect(Math.hypot(...move) * 50).toBeLessThan(6);
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
test('a spare police helicopter the player flies is not dismissed under him', async () => {
  await RAPIER.init();
  const sim = { player: { position: { x: 0, y: 0, z: 0 } }, world: { castRay: () => null }, playerCollider: {} } as any;
  const body = { translation: () => ({ x: 0, y: 30, z: 0 }), linvel: () => ({ x: 0, y: 0, z: 0 }), rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }) };
  const flown = { disposed: false, health: 1000, occupied: true, entryBusy: false, body, dispose() { this.disposed = true; } } as any;
  const spare = { disposed: false, health: 1000, occupied: false, entryBusy: false, body, cancelEntry() {}, dispose() { this.disposed = true; } } as any;
  const fleet = { planes: new Set([flown, spare]), spawnPlane: async () => { throw new Error('no pad'); }, removePlane(p: any) { p.dispose(); this.planes.delete(p); } } as any;
  const police = new WorldPolice(sim, fleet, { level: 0, native: { helisRequired: 0 } } as any, {} as any, 'http://invalid/', () => 0);
  police.helis.push(flown, spare);
  (police as any).updateHelis(undefined);
  expect(flown.disposed).toBe(false);
  expect(spare.disposed).toBe(true);
});
