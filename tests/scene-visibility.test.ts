import { expect, test } from 'vitest';
import { Group, PerspectiveCamera } from 'three';
import { sceneVisibility } from '../src/render/sceneVisibility';
import type { ScenePart } from '../src/assets/scene';

function fixture(distances: number[], parents: number[]) {
  const parts = distances.map((distance, i) => ({ name: `model${i}`, collision: undefined,
    definition: { id: i, model: `model${i}`, dictionary: 'x', section: 'objs', drawDistance: distance },
    placements: [{ modelId: i, modelName: `model${i}`, instanceType: 0, interior: 0, position: [0, 0, 0], rotation: [0, 0, 0, 1], lodIndex: parents[i] }],
    sourceRefs: [{ namespace: 'primary', index: i, format: 'text', sourceName: 'test.ipl', ...(parents[i] >= 0 ? { lodTarget: { namespace: 'primary', index: parents[i] } } : {}) }],
  })) as ScenePart[];
  const roots = parts.map(() => { const root = new Group(); root.add(new Group()); return root; });
  const camera = new PerspectiveCamera(55, 1, .1, 650), visibility = sceneVisibility(parts, roots);
  return { parts, roots, camera, visibility };
}

test('distance selection switches detailed children to their replacement at the nominal boundary', () => {
  const { roots, camera, visibility } = fixture([100, 400], [1, -1]);
  camera.position.x = 99.99; visibility.update(camera); expect(visibility.models()).toEqual(['model0']);
  camera.position.x = 100; visibility.update(camera); expect(visibility.models()).toEqual(['model1']);
  camera.position.x = 400; visibility.update(camera); expect(visibility.count).toBe(0);
  camera.position.x = 10; roots[0].visible = false; visibility.update(camera); expect(visibility.models()).toEqual(['model1']);
  roots[0].visible = true; visibility.update(camera); expect(visibility.models()).toEqual(['model0']);
});

test('shared and nested replacements propagate rendered children independently of model order', () => {
  const { roots, camera, visibility } = fixture([500, 200, 50, 80], [-1, 0, 1, 1]);
  visibility.update(camera); expect(visibility.models()).toEqual(['model2', 'model3']);
  camera.position.x = 60; visibility.update(camera); expect(visibility.models()).toEqual(['model3']);
  camera.position.x = 80; visibility.update(camera); expect(visibility.models()).toEqual(['model1']);
  camera.position.x = 200; visibility.update(camera); expect(visibility.models()).toEqual(['model0']);
  roots[0].visible = false; visibility.update(camera); expect(visibility.count).toBe(0);
});

test('distance uses the resolved parent origin in converted coordinates and bounds extend far clipping', () => {
  const f = fixture([20, 500], [1, -1]);
  f.parts[1].placements[0].position = [100, 200, 5];
  const visibility = sceneVisibility(f.parts, f.roots);
  f.camera.position.set(100, 5, -200); visibility.update(f.camera); expect(visibility.models()).toEqual(['model0']);
  f.camera.position.set(0, 0, 0); visibility.update(f.camera); expect(visibility.models()).toEqual(['model1']);
  const a = fixture([500], [-1]); a.parts[0].visibilityBounds = { bounds: { min: [-10,-10,-10], max: [10,10,10], center: [0,0,0], radius: 10 }, sourceModel: 'donor', inherited: true };
  const bounded = sceneVisibility(a.parts, a.roots); a.camera.far = 100;
  a.camera.position.x = 109; bounded.update(a.camera); expect(bounded.count).toBe(1);
  a.camera.position.x = 110; bounded.update(a.camera); expect(bounded.count).toBe(0);
});
