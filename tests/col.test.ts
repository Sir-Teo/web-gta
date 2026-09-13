import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { readCol } from '../src/assets/col';
const fixture = (version: number) => new Uint8Array(readFileSync(`tests/fixtures/dragonff-collision-v${version}.col`));
test('independent COL2 export preserves volumes, compressed mesh, surfaces and face groups', () => {
  const [model] = readCol(fixture(2));
  expect(model.name).toBe('diagnostic_col2'); expect(model.id).toBe(102);
  expect(model.spheres).toEqual([{ center: [0, 0, 1], radius: 0.5, surface: { material: 7, flags: 2, brightness: 3, light: 0xA3 } }]);
  expect(model.boxes[0].min).toEqual([-1, -1, -0.5]); expect(model.boxes[0].max).toEqual([1, 1, 0]);
  expect([...model.mesh.positions]).toEqual([-2, -2, 0, 2, -2, 0, 2, 2, 0, -2, 2, 0]);
  expect([...model.mesh.indices]).toEqual([0, 1, 2, 0, 2, 3]);
  expect([...model.mesh.materials]).toEqual([10, 11]); expect([...model.mesh.lights]).toEqual([0xC5, 0xD6]);
  expect(model.faceGroups).toEqual([{ min: [-2, -2, 0], max: [2, 2, 0], start: 0, end: 1 }]);
  expect(model.shadow).toBeNull();
});
test('COL3 keeps shadow triangles separate and collections accept final IMG padding', () => {
  const a = fixture(2), b = fixture(3), bytes = new Uint8Array(a.length + b.length + 256); bytes.set(a); bytes.set(b, a.length);
  const models = readCol(bytes); expect(models).toHaveLength(2);
  expect([...models[1].shadow!.positions]).toEqual([-1, -1, 0.25, 1, -1, 0.25, 0, 1, 0.25]);
  expect([...models[1].shadow!.indices]).toEqual([0, 1, 2]); expect(models[1].mesh.indices).toHaveLength(6);
});
test('COL rejects truncation, invalid ranges, overlapping data and malformed volume geometry', () => {
  const mutate = (edit: (v: DataView) => void) => { const bytes = fixture(2); edit(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)); return bytes; };
  expect(() => readCol(fixture(2).slice(0, -1))).toThrow('Truncated');
  expect(() => readCol(mutate(v => v.setUint32(96, 4, true)))).toThrow('range');
  expect(() => readCol(mutate(v => v.setUint32(88, v.getUint32(84, true), true)))).toThrow('Overlapping');
  expect(() => readCol(mutate(v => v.setFloat32(68, -1, true)))).toThrow('radius');
  expect(() => readCol(mutate(v => v.setFloat32(32, NaN, true)))).toThrow('Non-finite');
  expect(() => readCol(mutate(v => v.setUint16(v.getUint32(100, true) + 4, 65535, true)))).toThrow('range');
});
test('COL reports unsupported formats/lines and rejects ambiguous collection names', () => {
  const bytes = fixture(2); bytes[78] = 1; expect(() => readCol(bytes)).toThrow('suspension');
  expect(() => readCol(new TextEncoder().encode('COLL0000'))).toThrow('Unsupported');
  const a = fixture(2), duplicate = new Uint8Array(a.length * 2); duplicate.set(a); duplicate.set(a, a.length);
  expect(() => readCol(duplicate)).toThrow('Duplicate'); expect(() => readCol(new Uint8Array(16))).toThrow('No collision');
});

test('collision overlay preserves source placement and shares repeated volume geometry without shadows', async () => {
  const { collisionOverlay } = await import('../src/assets/CollisionOverlay');
  const { Vector3 } = await import('three');
  const placement = { modelId: 103, modelName: 'diagnostic_col3', position: [10, 20, 3] as [number, number, number], rotation: [0, 0, 0, 1] as [number, number, number, number], instanceType: 0, interior: 0, lodIndex: -1 };
  const overlay = collisionOverlay(readCol(fixture(3))[0], [placement, { ...placement, position: [20, 20, 3] }]);
  expect(overlay.root.children).toHaveLength(2); expect(overlay.root.children[0].children).toHaveLength(3);
  const sphere = overlay.root.children[0].children[0];
  sphere.getWorldPosition(new Vector3()).toArray().forEach((v, i) => expect(v).toBeCloseTo([10, 4, -20][i]));
  expect((sphere as any).geometry).toBe((overlay.root.children[1].children[0] as any).geometry);
  let disposed = 0; (sphere as any).geometry.addEventListener('dispose', () => disposed++); overlay.dispose(); overlay.dispose(); expect(disposed).toBe(1);
});
