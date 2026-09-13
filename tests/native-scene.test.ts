import { readFileSync } from 'node:fs';
import { beforeAll, afterEach, expect, test } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Scene, Group } from 'three';
import { readDff } from '../src/assets/dff';
import { readCol } from '../src/assets/col';
import { installNativeScene } from '../src/simulation/nativeScene';
import type { ScenePart } from '../src/assets/scene';
const makePart = (): ScenePart => ({
  model: readDff(new Uint8Array(readFileSync('tests/fixtures/dragonff-model.dff'))),
  collision: readCol(new Uint8Array(readFileSync('tests/fixtures/dragonff-collision-v3.col')))[0],
  name: 'diagnostic_col3', textures: [], dictionaryNames: [], notices: [], collisionSource: 'diagnostic.col',
  placements: [0, 10].map(x => ({ modelId: 103, modelName: 'diagnostic_col3', instanceType: 0, interior: 0, position: [x, 0, 0], rotation: [0, 0, 0, 1], lodIndex: -1 })),
});
let world: RAPIER.World;
beforeAll(async () => { await RAPIER.init(); });
afterEach(() => world?.free());
test('native scene installs both visual instances and physical source metadata and unloads only its own objects', () => {
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const scene = new Scene(), existing = new Group(); scene.add(existing);
  world.createCollider(RAPIER.ColliderDesc.ball(1).setTranslation(100, 0, 0));
  const installed = installNativeScene(world, scene, [makePart()]); world.step();
  expect(installed.instanceCount).toBe(2); expect(installed.colliderCount).toBe(6); expect(scene.children).toHaveLength(2);
  const hit = world.castRay(new RAPIER.Ray({ x: 10, y: 5, z: 0 }, { x: 0, y: -1, z: 0 }), 10, true)!;
  expect(hit.timeOfImpact).toBeCloseTo(3.5, 4);
  expect(installed.sources.get(hit.collider.handle)).toMatchObject({ modelName: 'diagnostic_col3', source: { kind: 'sphere' }, placement: { position: [10, 0, 0] } });
  const meshes: any[] = []; installed.root.traverse(o => { if ((o as any).isMesh) meshes.push(o); });
  expect(meshes).toHaveLength(2); expect(meshes[0].geometry).toBe(meshes[1].geometry);
  installed.setNight(1); expect(meshes[0].geometry.getAttribute('color').array[0]).toBeLessThan(1);
  installed.dispose(); installed.dispose(); expect(scene.children).toEqual([existing]); expect(world.bodies.len()).toBe(0); expect(world.colliders.len()).toBe(1);
});
test('native scene rollback removes earlier objects when later visual bounds fail', () => {
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }); const scene = new Scene();
  const invalid = makePart(); invalid.placements[0].position[0] = 1e7;
  expect(() => installNativeScene(world, scene, [makePart(), invalid])).toThrow('bounds');
  expect(scene.children).toHaveLength(0); expect(world.bodies.len()).toBe(0); expect(world.colliders.len()).toBe(0);
});
test('missing collision and transformed scene roots are explicit installation decisions', () => {
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }); const scene = new Scene(), part = makePart(); part.collision = undefined;
  expect(() => installNativeScene(world, scene, [part])).toThrow('Missing collision');
  expect(world.bodies.len()).toBe(0);
  const visualOnly = installNativeScene(world, scene, [part], { allowMissingCollision: true }); expect(visualOnly.missingCollision).toEqual(['diagnostic_col3']); expect(visualOnly.colliderCount).toBe(0); visualOnly.dispose();
  const excessive = makePart(); excessive.placements = Array(4097).fill(excessive.placements[0]); expect(() => installNativeScene(world, scene, [excessive])).toThrow('limits');
  scene.position.x = 1; expect(() => installNativeScene(world, scene, [makePart()])).toThrow('untransformed');
});
