import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Matrix4, SkinnedMesh, Vector3 } from 'three';
import { bindAnimation } from '../src/animation/bind';
import { modelObject, placedModelObjects } from '../src/assets/ModelObjects';
import { readDff } from '../src/assets/dff';
import { readIfp, type NativeAnimation } from '../src/assets/ifp';
const model = () => readDff(new Uint8Array(readFileSync('tests/fixtures/dragonff-skin.dff')));
// Reuse the independently packed source tracks; bind IDs explicitly to the diagnostic rig.
const clip = (): NativeAnimation => {
  const source = readIfp(new Uint8Array(readFileSync('tests/fixtures/animation-anp3.ifp'))).animations[0];
  source.tracks[0].boneId = 10; source.tracks[1].name = ' tip '; return source;
};
function mesh(root: ReturnType<typeof modelObject>['root']) { let mesh!: SkinnedMesh; root.traverse(o => { if (o instanceof SkinnedMesh) mesh = o; }); return mesh; }
test('native tracks resolve by ID/name, apply source rotations once, and restore exact rest pose', () => {
  const data = model(), object = modelObject(data), animation = bindAnimation(data, object.root, clip()), skinned = mesh(object.root);
  const tip = object.root.getObjectByName('Tip')!, rest = tip.matrix.clone();
  expect(animation.trackCount).toBe(2); expect(animation.sample(1, false)).toBe(1);
  // Root turns +90 degrees and translates; child also turns +90 at its rest z=1.
  const vertex = skinned.applyBoneTransform(4, new Vector3(-.5, 0, 2));
  expect(vertex.distanceTo(new Vector3(1.5, -2, 2.5))).toBeLessThan(.001);
  expect(tip.matrix.elements[14]).toBe(1); expect(skinned.frustumCulled).toBe(false);
  expect(skinned.boundingBox).toBeNull(); animation.updateBounds(); expect(skinned.boundingBox).not.toBeNull();
  animation.restore(); expect(skinned.frustumCulled).toBe(true); expect(tip.matrix).toEqual(rest);
  expect(skinned.applyBoneTransform(4, new Vector3(-.5, 0, 2)).distanceTo(new Vector3(-.5, 0, 2))).toBeLessThan(1e-6);
  object.dispose();
});
test('binding failure is atomic and name fallback never overrides a missing explicit bone ID', () => {
  const data = model(), object = modelObject(data), original = object.root.getObjectByName('Root')!.matrix.clone();
  const bad = clip(); bad.tracks[1].boneId = 999;
  expect(() => bindAnimation(data, object.root, bad)).toThrow('999');
  expect(object.root.getObjectByName('Root')!.matrix).toEqual(original);
  bad.tracks[1].boneId = 10; expect(() => bindAnimation(data, object.root, bad)).toThrow('distinct');
  object.dispose();
});
test('clip sampling is frame-rate independent and looping restores the initial clip phase', () => {
  const data = model(), a = modelObject(data), b = modelObject(data), ac = bindAnimation(data, a.root, clip()), bc = bindAnimation(data, b.root, clip());
  for (let i = 0; i <= 60; i++) ac.sample(i / 60);
  bc.sample(1); expect(a.root.getObjectByName('Tip')!.matrix).toEqual(b.root.getObjectByName('Tip')!.matrix);
  ac.sample(2); bc.sample(0); expect(a.root.getObjectByName('Root')!.matrix).toEqual(b.root.getObjectByName('Root')!.matrix);
  a.dispose(); b.dispose();
});
test('binding rejects a multi-instance root and sheared rest frames without altering geometry', () => {
  const data = model(), placement = { modelId: 0, modelName: 'rig', instanceType: 0, interior: 0, position: [0,0,0] as [number,number,number], rotation: [0,0,0,1] as [number,number,number,number], lodIndex: -1 };
  const placed = placedModelObjects(data, [], [placement, placement]);
  expect(() => bindAnimation(data, placed.root, clip())).toThrow('one model instance'); placed.dispose();
  data.frames[1].matrix = new Matrix4().makeShear(.5, 0, 0, 0, 0, 0).toArray();
  const object = modelObject(data); expect(() => bindAnimation(data, object.root, clip())).toThrow('sheared'); object.dispose();
});
