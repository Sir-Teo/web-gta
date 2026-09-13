import { readFileSync } from 'node:fs';
import { test, expect } from 'vitest';
import * as THREE from 'three';
import { readDff } from '../src/assets/dff';
import { modelObject } from '../src/assets/ModelPreview';
const fixture = (name = 'dragonff-model.dff') => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
function section(data: Uint8Array, type: number, start = 0, end = data.length): number {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let at = start; at + 12 <= end;) {
    const id = view.getUint32(at, true), next = at + 12 + view.getUint32(at + 4, true);
    if (id === type) return at;
    if ([0x10, 0xe, 0x1a, 0xf, 3, 7, 8, 0x14].includes(id)) { const found = section(data, type, at + 12, next); if (found >= 0) return found; }
    at = next;
  }
  return -1;
}
test('independent DFF preserves triangle winding, hierarchy, UVs, materials and night colors', () => {
  const model = readDff(fixture()), g = model.geometries[0];
  expect(model.frames.map(f => f.name)).toEqual(['diagnostic_root', 'rotated_pyramid']);
  expect([...g.normals!.slice(0, 3)]).toEqual([0, 0, 1]);
  expect(model.frames[1].parent).toBe(0); expect([...g.indices.slice(0, 3)]).toEqual([0, 1, 4]);
  expect([...g.uvs[0].slice(-2)]).toEqual([0.5, 0.5]); expect([...g.nightColors!.slice(0, 4)]).toEqual([30, 45, 95, 255]);
  expect(g.materials[0].texture).toBe('calibration_grid'); expect(g.materials[0].addressU).toBe(1);
  expect(g.materials[1].color).toEqual([255, 140, 60, 255]); expect([...g.materialIds]).toEqual([0, 0, 0, 0, 1, 1]);
});
test('a single basis transform preserves world positions, scale, winding and color interpolation', () => {
  const model = readDff(fixture()), visual = modelObject(model);
  try {
    const center = new THREE.Box3().setFromObject(visual.root).getCenter(new THREE.Vector3());
    expect(center.x).toBeCloseTo(4); expect(center.y).toBeCloseTo(8.5); expect(center.z).toBeCloseTo(-4);
    const frame = visual.root.getObjectByName('rotated_pyramid')!;
    const top = frame.localToWorld(new THREE.Vector3(0, 0, 3));
    expect(top.x).toBeCloseTo(4); expect(top.y).toBeCloseTo(10); expect(top.z).toBeCloseTo(-4);
    expect(frame.matrixWorld.determinant()).toBeCloseTo(1);
    const mesh = frame.children[0] as THREE.Mesh<THREE.BufferGeometry>;
    expect(mesh.geometry.groups.map(g => [g.count, g.materialIndex])).toEqual([[12, 0], [6, 1]]);
    visual.setNight(0.5); expect(mesh.geometry.getAttribute('color').getX(0)).toBeCloseTo(105 / 255);
    visual.setNight(1); expect(mesh.geometry.getAttribute('color').getZ(4)).toBeCloseTo(95 / 255);
  } finally { visual.dispose(); }
});
test('independently exported triangle strips retain all faces and outward orientation', () => {
  const a = readDff(fixture()).geometries[0], b = readDff(fixture('dragonff-model-strips.dff')).geometries[0];
  const faces = (indices: Uint32Array) => {
    const out: string[] = [];
    for (let i = 0; i < indices.length; i += 3) { const v = [...indices.slice(i, i + 3)]; while (v[0] !== Math.min(...v)) v.push(v.shift()!); out.push(v.join(',')); }
    return out.sort();
  };
  expect(faces(b.indices)).toEqual(faces(a.indices));
});
test('model reader rejects truncation, invalid indices, cyclic frames, native data and malformed skin payloads', () => {
  const bytes = fixture();
  for (const length of [0, 11, 50, bytes.length - 1]) expect(() => readDff(bytes.slice(0, length))).toThrow();
  for (const mutate of [
    (b: Uint8Array, v: DataView) => v.setInt32(section(b, 0xe) + 12 + 12 + 4 + 48, 1, true),
    (b: Uint8Array, v: DataView) => v.setUint32(section(b, 0xf) + 24, 0x01000000, true),
    (b: Uint8Array, v: DataView) => v.setUint16(section(b, 0xf) + 24 + 16 + 20 + 40, 65000, true),
    (b: Uint8Array, v: DataView) => v.setUint32(section(b, 0x50e), 0x116, true),
    (b: Uint8Array, v: DataView) => v.setFloat32(section(b, 0xe) + 28, NaN, true),
  ]) { const b = bytes.slice(); mutate(b, new DataView(b.buffer)); expect(() => readDff(b)).toThrow(); }
});


test('preview refuses extreme composed world bounds before drawing', () => {
  const model = readDff(fixture()); model.frames[0].matrix[12] = 1e20;
  expect(() => modelObject(model)).toThrow('coordinate limit');
});
