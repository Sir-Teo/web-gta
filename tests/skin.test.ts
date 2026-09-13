import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Bone, SkinnedMesh, Vector3 } from 'three';
import { readDff } from '../src/assets/dff';
import { readSkin, readHAnim } from '../src/assets/skin';
import { modelObject, placedModelObjects } from '../src/assets/ModelObjects';
import { skinFrames } from '../src/animation/skeleton';
const fixture = () => new Uint8Array(readFileSync('tests/fixtures/dragonff-skin.dff'));
const model = () => readDff(fixture());
function skinBytes() {
  const bytes = Buffer.from(fixture()), start = bytes.indexOf(Buffer.from([0x16, 1, 0, 0]));
  expect(start).toBeGreaterThan(0); return new Uint8Array(bytes.subarray(start + 12, start + 12 + bytes.readUInt32LE(start + 4)));
}
function meshes(root: { traverse: (callback: (object: any) => void) => void }) { const result: SkinnedMesh[] = []; root.traverse(o => { if (o instanceof SkinnedMesh) result.push(o); }); return result; }
test('independent DragonFF skin preserves palette, weights and inverse bind matrices', () => {
  const data = model(), skin = data.geometries[0].skin!;
  expect(skin.boneCount).toBe(2); expect([...skin.usedBones]).toEqual([0, 1]);
  expect(skinFrames(data, 2)).toEqual([2, 1]); expect(skin.inverseMatrices[30]).toBe(-1);
  expect([...skin.weights.slice(8, 12)]).toEqual([.5, .5, 0, 0]);
  expect(data.frames[2].hanim!.nodes.map(n => n.id)).toEqual([10, 42]);
});
test('bind pose agrees with source vertices and moving a bone deforms only its weighted region', () => {
  const data = model(), object = modelObject(data), mesh = meshes(object.root)[0];
  expect(mesh).toBeInstanceOf(SkinnedMesh); expect(mesh.skeleton.bones.every(b => b instanceof Bone)).toBe(true);
  const source = new Vector3().fromArray(data.geometries[0].positions, 12);
  expect(mesh.applyBoneTransform(4, source.clone()).distanceTo(source)).toBeLessThan(1e-6);
  object.root.getObjectByName('Tip')!.matrix.makeTranslation(1, 0, 1); object.root.updateMatrixWorld(true);
  expect(mesh.applyBoneTransform(4, source.clone()).x).toBeCloseTo(source.x + 1, 6);
  expect(mesh.applyBoneTransform(0, new Vector3(-.5, 0, 0)).x).toBeCloseTo(-.5, 6);
  expect(mesh.applyBoneTransform(2, new Vector3(-.5, 0, 1)).x).toBeCloseTo(0, 6);
  object.dispose(); object.dispose();
});
test('placed skins share geometry while their skeletons and bone poses remain independent', () => {
  const placement = { modelId: 0, modelName: 'rig', instanceType: 0, interior: 0, position: [0,0,0] as [number,number,number], rotation: [0,0,0,1] as [number,number,number,number], lodIndex: -1 };
  const object = placedModelObjects(model(), [], [placement, { ...placement, position: [10,0,0] }]);
  const [a,b] = meshes(object.root); expect(a.geometry).toBe(b.geometry); expect(a.skeleton).not.toBe(b.skeleton); expect(a.skeleton.bones[1]).not.toBe(b.skeleton.bones[1]);
  a.skeleton.bones[1].matrix.makeTranslation(1,0,1); object.root.updateMatrixWorld(true);
  expect(a.applyBoneTransform(4, new Vector3(-.5,0,2)).x).toBeCloseTo(.5, 5);
  expect(b.applyBoneTransform(4, new Vector3(-.5,0,2)).x).toBeCloseTo(-.5, 5);
  let disposed = 0; for (const mesh of [a,b]) mesh.skeleton.boneTexture = { dispose: () => disposed++ } as any;
  object.dispose(); object.dispose(); expect(disposed).toBe(2);
});
test('missing or ambiguous bone mapping fails before object creation', () => {
  const data = model(); data.frames[1].hanim!.id = 10;
  expect(() => modelObject(data)).toThrow('ambiguous HAnim frame');
});
test('skin parser rejects truncated payloads, invalid references, weights and split remapping', () => {
  const bytes = skinBytes();
  for (let i = 0; i < bytes.length; i++) expect(() => readSkin(bytes.subarray(0, i), 6)).toThrow();
  const alter = (fn: (b: Uint8Array, v: DataView) => void) => { const b = bytes.slice(); fn(b, new DataView(b.buffer)); return b; };
  expect(() => readSkin(alter(b => b[6] = 5), 6)).toThrow('unavailable bone');
  expect(() => readSkin(alter((b,v) => v.setFloat32(30, -.5, true)), 6)).toThrow('weight');
  expect(() => readSkin(alter((b,v) => v.setUint32(b.length - 8, 1, true)), 6)).toThrow('Split skin');
  // Matrix metadata lanes may contain non-float flags; normalize those lanes only.
  const flags = alter((b,v) => v.setUint32(126 + 12, 0xffffffff, true));
  expect(readSkin(flags, 6).inverseMatrices[3]).toBe(0);
});
test('HAnim parser bounds node counts and rejects duplicate palette indices', () => {
  const bytes = new Uint8Array(44), v = new DataView(bytes.buffer); v.setUint32(0, 0x100, true); v.setUint32(8, 2, true);
  v.setUint32(20, 10, true); v.setUint32(32, 42, true);
  expect(() => readHAnim(bytes)).toThrow('bone mapping');
  v.setUint32(36, 1, true); expect(readHAnim(bytes).nodes).toHaveLength(2);
});
