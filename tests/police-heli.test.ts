import { expect, test } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { hoverFlight } from '../src/simulation/hoverFlight';
import { heliHeading, heliOrbitPoint, helisRequired, policeHeliInputs, HELI_HOVER_HEIGHT, HELI_ORBIT_RADIUS } from '../src/simulation/policeHeli';

test('heli backup follows the native star schedule', () => {
  expect(helisRequired(0)).toBe(0);
  expect(helisRequired(2)).toBe(0);
  expect(helisRequired(3)).toBe(1);
  expect(helisRequired(4)).toBe(2);
  expect(helisRequired(6)).toBe(2);
});

test('hover orbit holds above a stationary suspect', () => {
  const suspect = { x: 60, y: 10, z: -40 };
  expect(heliOrbitPoint(suspect, 0)).toEqual({ x: 60 + HELI_ORBIT_RADIUS, y: 10 + HELI_HOVER_HEIGHT, z: -40 });
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
