import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, expect, test } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Matrix4, Vector3 } from 'three';
import { Simulation } from '../src/simulation/Simulation';
import { locomotionMotion } from '../src/animation/locomotion';
import { readIfp } from '../src/assets/ifp';
let sim: Simulation;
beforeAll(async () => RAPIER.init()); afterEach(() => sim?.dispose());
function setup() {
  sim = new Simulation(true); sim.respawn = { x: 0, y: .03, z: 0 }; sim.resetPlayer();
  sim.world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array([-20,0,-20, -20,0,20, 20,0,20, 20,0,-20]), new Uint32Array([0,1,2, 0,2,3]))); sim.world.step();
  return locomotionMotion(readIfp(new Uint8Array(readFileSync('tests/fixtures/animation-rig.ifp'))).animations[0], { track: 0 });
}
const basis = new Matrix4().makeRotationX(-Math.PI / 2);
const controls = { x: 0, y: 1, cameraYaw: 0, sprint: false, jump: false, handbrake: false };
test('clip motion replaces ordinary walking displacement and remains supported across a loop', () => {
  const motion = setup();
  const requested = { x: 0, z: 0 }, applied = { x: 0, z: 0 };
  for (let i=0; i<180; i++) {
    sim.step(1/60, { ...controls, animationMotion: motion.between(i/60, (i+1)/60, basis) });
    for (const axis of ['x', 'z'] as const) {
      requested[axis] += sim.animationMovement!.requested[axis];
      applied[axis] += sim.animationMovement!.applied[axis];
    }
  }
  expect(requested.x).toBeCloseTo(3, 6); expect(requested.z).toBeCloseTo(6, 6);
  expect(sim.player.position.x).toBeCloseTo(applied.x, 4); expect(sim.player.position.z).toBeCloseTo(applied.z, 4);
  // Keep contact rounding below two centimeters over this six-meter path.
  expect(Math.abs(applied.x - 3)).toBeLessThan(.02);
  expect(Math.abs(applied.z - 6)).toBeLessThan(.02);
  expect(sim.player.grounded).toBe(true); expect(sim.player.position.y).toBeCloseTo(0, 1);
});
test('root-driven capsule stops at a wall and reports requested versus collision-applied motion', () => {
  const motion = setup(); sim.world.createCollider(RAPIER.ColliderDesc.cuboid(10, 3, .1).setTranslation(0, 3, 2)); sim.world.step();
  for (let i=0; i<180; i++) sim.step(1/60, { ...controls, animationMotion: motion.between(i/60, (i+1)/60, basis) });
  expect(sim.player.position.z).toBeLessThan(1.61); expect(sim.player.position.z).toBeGreaterThan(1.4);
  expect(sim.animationMovement!.requested.z).toBeCloseTo(2/60, 6);
  expect(Math.abs(sim.animationMovement!.applied.z)).toBeLessThan(.001);
  expect(sim.player.position.x).toBeGreaterThan(2.5);
});
test('incapacitation suppresses animation movement and ordinary steps clear feedback', () => {
  setup(); sim.player.health = 0;
  sim.step(1/60, { ...controls, animationMotion: { x: 1, z: 1 } });
  expect(sim.animationMovement!.requested).toEqual({ x: 0, z: 0 }); expect(sim.player.position.x).toBe(0);
  sim.step(1/60, controls); expect(sim.animationMovement).toBeNull();
  expect(() => sim.step(1/60, { ...controls, animationMotion: { x: NaN, z: 0 } })).toThrow('finite');
});
test('displacement transforms include heading and scale, exclude translation, and reject vertical extraction', () => {
  const motion = setup();
  const transform = new Matrix4().makeRotationY(Math.PI/2).multiply(basis).scale(new Vector3(2, 2, 2)).setPosition(100,200,300);
  const delta = motion.between(0,1,transform); expect(delta.x).toBeCloseTo(4, 6); expect(delta.z).toBeCloseTo(-2, 6);
  expect(() => motion.between(0,1,new Matrix4())).toThrow('horizontal');
});

test('zero clip displacement prevents keyboard walking from being added', () => {
  setup();
  for (let i=0; i<60; i++) sim.step(1/60, { ...controls, animationMotion: { x: 0, z: 0 } });
  expect(sim.player.position.x).toBeCloseTo(0, 5); expect(sim.player.position.z).toBeCloseTo(0, 5);
  for (let i=0; i<60; i++) sim.step(1/60, controls);
  expect(sim.player.position.z).toBeLessThan(-3);
});
