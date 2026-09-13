import { readFileSync } from 'node:fs';
import { beforeAll, afterEach, expect, test } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { readCol } from '../src/assets/col';
import { installNativeCollision } from '../src/simulation/nativeCollision';
import type { IplInstance } from '../src/assets/ipl';
const model = () => readCol(new Uint8Array(readFileSync('tests/fixtures/dragonff-collision-v3.col')))[0];
const placement: IplInstance = { modelId: 103, modelName: 'diagnostic_col3', position: [10, 20, 3], rotation: [0, 0, 0, 1], instanceType: 0, interior: 0, lodIndex: -1 };
let world: RAPIER.World;
beforeAll(async () => { await RAPIER.init(); });
afterEach(() => world?.free());
function setup() { world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }); world.timestep = 1 / 60; }
test('source sphere, box and triangle geometry produce distinct ray hits and retain surface metadata', () => {
  setup(); const native = installNativeCollision(world, model(), placement); world.step();
  expect(native.sources.size).toBe(3);
  const ray = (x: number, z: number) => world.castRay(new RAPIER.Ray({ x, y: 8, z }, { x: 0, y: -1, z: 0 }), 10, true)!;
  const sphere = ray(10, -20); expect(sphere.timeOfImpact).toBeCloseTo(3.5, 4);
  expect(native.sources.get(sphere.collider.handle)).toMatchObject({ kind: 'sphere', surface: { material: 7, light: 0xA3 } });
  // Outside the sphere and box, hit the physical plane at y=3.
  const floor = ray(11.5, -20); expect(floor.timeOfImpact).toBeCloseTo(5, 4);
  expect(native.sources.get(floor.collider.handle)?.kind).toBe('mesh');
  const box = world.castRay(new RAPIER.Ray({ x: 8, y: 2.75, z: -20 }, { x: 1, y: 0, z: 0 }), 5, true)!;
  expect(box.timeOfImpact).toBeCloseTo(1, 4); expect(native.sources.get(box.collider.handle)).toMatchObject({ kind: 'box', surface: { material: 9 } });
});
test('IPL rotation places a source collision plane vertically with the expected contact normal', () => {
  setup(); const source = model(); source.spheres = []; source.boxes = [];
  installNativeCollision(world, source, { ...placement, rotation: [Math.SQRT1_2, 0, 0, Math.SQRT1_2] }); world.step();
  const hit = world.castRayAndGetNormal(new RAPIER.Ray({ x: 10, y: 3, z: -25 }, { x: 0, y: 0, z: 1 }), 10, true)!;
  expect(hit).not.toBeNull(); expect(hit.timeOfImpact).toBeCloseTo(5, 4); expect(Math.abs(hit.normal.z)).toBeCloseTo(1, 4);
});
test('a falling dynamic body rests on native collision and unloading removes every shape', () => {
  setup(); const source = model(); source.spheres = []; source.boxes = [];
  const native = installNativeCollision(world, source, placement);
  const ball = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(10, 6, -20).setCcdEnabled(true));
  world.createCollider(RAPIER.ColliderDesc.ball(0.25).setRestitution(0), ball);
  for (let i = 0; i < 180; i++) world.step();
  expect(ball.translation().y).toBeCloseTo(3.25, 1); expect(Math.abs(ball.linvel().y)).toBeLessThan(0.05);
  native.dispose(); native.dispose(); expect(native.sources.size).toBe(0); expect(world.bodies.len()).toBe(1); expect(world.colliders.len()).toBe(1);
  for (let i = 0; i < 60; i++) world.step(); expect(ball.translation().y).toBeLessThan(1);
});
