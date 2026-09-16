import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Scene } from 'three';
import { readDff } from '../src/assets/dff';
import { readCol } from '../src/assets/col';
import { placedModelObjects } from '../src/assets/ModelObjects';
import { installNativeScene } from '../src/simulation/nativeScene';
import type { ScenePart } from '../src/assets/scene';

// Step 1 baseline: quantify current per-placement clone cost.
// No WebGL context in vitest, so draw calls are estimated as
// sum(mesh.geometry.groups.length) for visible meshes — this is what
// WebGLRenderer.render() will issue (1 call per group).
function audit(root: { traverse(cb: (o: any) => void): void }) {
  let objects = 0, meshes = 0, estimatedDraws = 0;
  const geometries = new Set<object>();
  root.traverse((o: any) => {
    objects++;
    if (o.isMesh) {
      meshes++;
      geometries.add(o.geometry);
      estimatedDraws += o.geometry.groups?.length ?? 1;
    }
  });
  return { objects, meshes, estimatedDraws, uniqueGeometries: geometries.size };
}

function makePart(placements: number): ScenePart {
  return {
    model: readDff(new Uint8Array(readFileSync('tests/fixtures/dragonff-model.dff'))),
    collision: readCol(new Uint8Array(readFileSync('tests/fixtures/dragonff-collision-v3.col')))[0],
    name: 'diagnostic_col3',
    textures: [],
    dictionaryNames: [],
    notices: [],
    collisionSource: 'diagnostic.col',
    placements: Array.from({ length: placements }, (_, x) => ({
      modelId: 103,
      modelName: 'diagnostic_col3',
      instanceType: 0,
      interior: 0,
      position: [x * 10, 0, 0] as [number, number, number],
      rotation: [0, 0, 0, 1] as [number, number, number, number],
      lodIndex: -1,
    })),
  };
}

test('step 1 baseline: per-placement clone cost scales linearly', async () => {
  await RAPIER.init();
  const report: Record<number, { objects: number; meshes: number; estimatedDraws: number; uniqueGeometries: number; colliders: number }> = {};
  for (const n of [1, 10, 50]) {
    const part = makePart(n);
    const placed = placedModelObjects(part.model, [], part.placements as any);
    const visual = audit(placed.root);
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const scene = new Scene();
    const installed = installNativeScene(world, scene, [part]);
    report[n] = { ...visual, colliders: installed.colliderCount };
    // Geometry/material storage is shared — the cost is Object3D count + draw calls.
    expect(visual.uniqueGeometries).toBeLessThanOrEqual(2);
    placed.dispose();
    installed.dispose();
    world.free();
  }
  // Document linear scaling: 50 placements ≈ 50x draws/objects of 1 placement.
  // This is the inefficiency step 3 (batching) must fix.
  expect(report[50].estimatedDraws).toBeGreaterThan(report[1].estimatedDraws * 10);
  expect(report[50].objects).toBeGreaterThan(report[1].objects * 10);
  expect(report[10].colliders).toBe(report[1].colliders * 10);
  console.info('BASELINE ' + JSON.stringify(report));
});
