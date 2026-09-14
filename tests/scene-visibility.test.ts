import { expect, test } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera } from 'three';
import { sceneVisibility } from '../src/render/sceneVisibility';
import type { ScenePart } from '../src/assets/scene';
import { placementMatrix } from '../src/assets/placement';

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

test('distance selection fades detailed children across the nominal boundary before replacing them', () => {
  const { roots, camera, visibility } = fixture([100, 400], [1, -1]);
  camera.position.x = 99.99; visibility.update(camera); expect(visibility.models()).toEqual(['model0']);
  camera.position.x = 100; visibility.update(camera); expect(visibility.models()).toEqual(['model0', 'model1']);
  camera.position.x = 120; visibility.update(camera); expect(visibility.models()).toEqual(['model1']);
  camera.position.x = 420; visibility.update(camera); expect(visibility.count).toBe(0);
  camera.position.x = 10; roots[0].visible = false; visibility.update(camera); expect(visibility.models()).toEqual(['model1']);
  roots[0].visible = true; visibility.update(camera); expect(visibility.models()).toEqual(['model0']);
});

test('shared and nested replacements propagate rendered children independently of model order', () => {
  const { roots, camera, visibility } = fixture([500, 200, 50, 80], [-1, 0, 1, 1]);
  visibility.update(camera); expect(visibility.models()).toEqual(['model2', 'model3']);
  camera.position.x = 60; visibility.update(camera); expect(visibility.models()).toEqual(['model2', 'model3']);
  camera.position.x = 100; visibility.update(camera); expect(visibility.models()).toEqual(['model1']);
  camera.position.x = 200; visibility.update(camera); expect(visibility.models()).toEqual(['model0', 'model1']);
  camera.position.x = 220; visibility.update(camera); expect(visibility.models()).toEqual(['model0']);
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
  a.camera.position.x = 109; a.camera.lookAt(0, 0, 0); a.camera.updateProjectionMatrix(); bounded.update(a.camera); expect(bounded.count).toBe(1);
  a.camera.position.x = 111; bounded.update(a.camera); expect(bounded.count).toBe(0);
});

function bound(part: ScenePart, center: [number, number, number], radius = 1) {
  part.visibilityBounds = { bounds: { min: [-radius,-radius,-radius], max: [radius,radius,radius], center, radius }, sourceModel: part.name, inherited: false };
}

test('off-screen children do not suppress an on-screen replacement and camera turns refresh coverage', () => {
  const f = fixture([100, 300], [1, -1]);
  bound(f.parts[0], [20, 10, 0]); bound(f.parts[1], [0, 10, 0], 4);
  const visibility = sceneVisibility(f.parts, f.roots);
  visibility.update(f.camera); expect(visibility.models()).toEqual(['model1']);
  f.camera.lookAt(20, 0, -10); visibility.update(f.camera); expect(visibility.models()).toEqual(['model0']);
  f.camera.lookAt(0, 0, -10); visibility.update(f.camera); expect(visibility.models()).toEqual(['model1']);
  f.camera.lookAt(0, 0, 10); visibility.update(f.camera); expect(visibility.count).toBe(0);
});

test('source sphere centers follow placement rotation and inherited bounds use the receiving placement', () => {
  const f = fixture([300], [-1]); bound(f.parts[0], [10, 0, 0]);
  f.parts[0].visibilityBounds!.inherited = true;
  // Inverse IPL rotation turns native +X into +Y, then axis conversion maps it to world -Z.
  f.parts[0].placements[0].rotation = [0, 0, -Math.SQRT1_2, Math.SQRT1_2];
  const visibility = sceneVisibility(f.parts, f.roots);
  visibility.update(f.camera); expect(visibility.count).toBe(1);
  f.camera.lookAt(10, 0, 0); visibility.update(f.camera); expect(visibility.count).toBe(0);
});

test('frustum eligibility responds to projection changes and rejects malformed source spheres', () => {
  const f = fixture([300], [-1]); bound(f.parts[0], [8, 10, 0]);
  const visibility = sceneVisibility(f.parts, f.roots);
  visibility.update(f.camera); expect(visibility.count).toBe(0);
  f.camera.aspect = 2; f.camera.updateProjectionMatrix(); visibility.update(f.camera); expect(visibility.count).toBe(1);
  f.parts[0].visibilityBounds!.bounds.radius = NaN;
  expect(() => sceneVisibility(f.parts, f.roots)).toThrow('visibility sphere');
});

test('COL-free geometry provides fallback bounds and a parented camera uses world position', () => {
  const f = fixture([50], [-1]), geometry = new BoxGeometry(2, 2, 2), material = new MeshBasicMaterial();
  const mesh = new Mesh(geometry, material); mesh.position.set(0, 0, -10); f.roots[0].children[0].add(mesh);
  const visibility = sceneVisibility(f.parts, f.roots), cameraParent = new Group(); cameraParent.add(f.camera);
  visibility.update(f.camera); expect(visibility.count).toBe(1);
  cameraParent.position.z = -20; visibility.update(f.camera); expect(visibility.count).toBe(0);
  cameraParent.position.z = 10; visibility.update(f.camera); expect(visibility.count).toBe(1);
  cameraParent.position.z = 70; visibility.update(f.camera); expect(visibility.count).toBe(0);
  geometry.dispose(); material.dispose();
});

test('geometry fallback retains a COL-free object whose sphere intersects the far plane', () => {
  const f = fixture([300], [-1]), geometry = new BoxGeometry(2, 2, 2), material = new MeshBasicMaterial();
  f.parts[0].placements[0].position = [0, 12, 0];
  const instance = f.roots[0].children[0]; instance.matrixAutoUpdate = false;
  instance.matrix.copy(placementMatrix(f.parts[0].placements[0])); instance.add(new Mesh(geometry, material));
  const visibility = sceneVisibility(f.parts, f.roots);
  f.camera.far = 11; f.camera.updateProjectionMatrix(); visibility.update(f.camera); expect(visibility.count).toBe(1);
  f.camera.far = 10; f.camera.updateProjectionMatrix(); visibility.update(f.camera); expect(visibility.count).toBe(0);
  geometry.dispose(); material.dispose();
});

test('low-LOD scaling affects only big root ranges, after clipping and before distance rejection',()=>{
 const f=fixture([100,400,100], [1,-1,-1]);
 f.camera.position.x=250;f.visibility.update(f.camera,.5);expect(f.visibility.models()).toEqual([]);
 f.visibility.update(f.camera,1);expect(f.visibility.models()).toEqual(['model1']);
 f.camera.position.x=125;f.visibility.update(f.camera,2);expect(f.visibility.models()).toEqual(['model1']); // ordinary 100-unit roots/children are not stretched
 f.camera.far=200;f.camera.position.x=300;f.visibility.update(f.camera,2);expect(f.visibility.models()).toEqual(['model1']); // min(400,200) * 2
 f.camera.position.x=405;f.visibility.update(f.camera,2);expect(f.visibility.models()).toEqual(['model1']);
 f.camera.position.x=420;f.visibility.update(f.camera,2);expect(f.visibility.count).toBe(0);
 expect(()=>f.visibility.update(f.camera,NaN)).toThrow('low-LOD');
});

test('long-distance unlinked roots scale, while nested replacements with their own LOD do not',()=>{
 const f=fixture([500,400,100],[ -1,0,1]);f.camera.position.x=250;f.visibility.update(f.camera,.5);expect(f.visibility.models()).toEqual(['model1']);
 const isolated=fixture([400],[-1]);isolated.camera.position.x=250;isolated.visibility.update(isolated.camera,.5);expect(isolated.visibility.count).toBe(0);isolated.visibility.update(isolated.camera,1);expect(isolated.visibility.count).toBe(1);
});
