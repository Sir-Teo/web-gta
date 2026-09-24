import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { readIpl } from '../src/assets/ipl';
import { placementMatrix } from '../src/assets/placement';
const text = (row: string) => new TextEncoder().encode(`inst\n${row}\nend`);
function binary() {
  const bytes = new Uint8Array(116), view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('bnry')); view.setUint32(4, 1, true); view.setUint32(28, 76, true);
  [10, 20, 30, 0, 0, Math.SQRT1_2, Math.SQRT1_2].forEach((v, i) => view.setFloat32(76 + i * 4, v, true));
  view.setInt32(104, 100, true); view.setUint32(108, 0x104, true); view.setInt32(112, 99, true); return bytes;
}
test('text and binary IPL preserve transforms, flags and unresolved external LOD references', () => {
  const a = readIpl(text(`100 diagnostic 260 10 20 30 0 0 ${Math.SQRT1_2} ${Math.SQRT1_2} 99`));
  const b = readIpl(binary());
  expect(a.instances[0].modelName).toBe('diagnostic'); expect(b.instances[0].modelName).toBeNull();
  for (const data of [a, b]) {
    expect(data.instances[0].position).toEqual([10, 20, 30]); expect(data.instances[0].interior).toBe(4);
    expect(data.instances[0].instanceType).toBe(260); expect(data.instances[0].lodIndex).toBe(99);
  }
});
test('IPL conjugate rotation and basis conversion preserve scale and handedness', () => {
  const instance = readIpl(binary()).instances[0], matrix = placementMatrix(instance);
  new Vector3().applyMatrix4(matrix).toArray().forEach((v, i) => expect(v).toBeCloseTo([10, 30, -20][i]));
  const origin = new Vector3().applyMatrix4(matrix), right = new Vector3(1, 0, 0).applyMatrix4(matrix).sub(origin);
  expect(right.x).toBeCloseTo(0); expect(right.y).toBeCloseTo(0); expect(right.z).toBeCloseTo(1);
  expect(matrix.determinant()).toBeCloseTo(1);
  const upside = { ...instance, rotation: [Math.SQRT1_2, 0, 0, Math.SQRT1_2] as [number, number, number, number] };
  const up = new Vector3(0, 0, 1).applyMatrix4(placementMatrix(upside)).sub(new Vector3().applyMatrix4(placementMatrix(upside)));
  expect(up.z).toBeCloseTo(-1);
});
test('IPL validates binary ranges, truncated records, malformed quaternions and text records', () => {
  expect(() => readIpl(binary().slice(0, 115))).toThrow('range');
  const corrupt = binary(); new DataView(corrupt.buffer).setUint32(28, 0, true); expect(() => readIpl(corrupt)).toThrow('range');
  for (const row of ['100 model 0 0 0 0 0 0 0 0 -1', '100 model 0 NaN 0 0 0 0 0 1 -1', '100 model 0 0 0 0 0 0 0 1 -2', '100 model 0 1 2']) expect(() => readIpl(text(row))).toThrow();
  expect(() => readIpl(new TextEncoder().encode('inst\n'))).toThrow('Unterminated');
});
test('IPL skips unrelated sections visibly and accepts comments and CRLF', () => {
  const data = readIpl(new TextEncoder().encode('# original fixture\r\ninst\r\n100, model, 0, 1, 2, 3, 0, 0, 0, 1, -1 # item\r\nend\r\nzone\r\nignored\r\nend'));
  expect(data.instances).toHaveLength(1); expect(data.warnings).toEqual(['IPL section zone is not imported.']);
});


test('model assembly composes an IPL placement with source frame transforms exactly once', async () => {
  const { readFileSync } = await import('node:fs');
  const { readDff } = await import('../src/assets/dff');
  const { modelObject } = await import('../src/assets/ModelPreview');
  const model = readDff(new Uint8Array(readFileSync('tests/fixtures/dragonff-model.dff')));
  const visual = modelObject(model, [], readIpl(binary()).instances[0]);
  // Diagnostic pyramid top is native (4, 4, 10) after its nested source frames.
  // IPL rotates it -90 degrees about native Z, translates (10,20,30), then converts axes.
  const top = visual.root.getObjectByName('rotated_pyramid')!.localToWorld(new Vector3(0, 0, 3));
  top.toArray().forEach((v, i) => expect(v).toBeCloseTo([14, 40, -16][i]));
  visual.dispose();
});

test('placement selection distinguishes models and interiors and requires binary ID resolution', async () => {
  const { matchingPlacements } = await import('../src/assets/ipl');
  const data = readIpl(new TextEncoder().encode('inst\n1 house 0 0 0 0 0 0 0 1 -1\n1 house 4 0 0 0 0 0 0 1 -1\n2 tree 0 0 0 0 0 0 0 1 -1\nend'));
  expect(matchingPlacements(data, 'HOUSE', undefined, 0)).toHaveLength(1);
  expect(matchingPlacements(data, 'house', undefined, 4)[0].interior).toBe(4);
  expect(() => matchingPlacements(readIpl(binary()), 'model', undefined, 4)).toThrow('IDE model ID');
  expect(matchingPlacements(readIpl(binary()), 'model', 100, 4)).toHaveLength(1);
  expect(() => matchingPlacements(data, 'house', 1, 0.5)).toThrow('Interior');
});
test('repeated placements share meshes and dispose their geometry only once', async () => {
  const { readFileSync } = await import('node:fs');
  const { readDff } = await import('../src/assets/dff');
  const { placedModelObjects } = await import('../src/assets/ModelPreview');
  const model = readDff(new Uint8Array(readFileSync('tests/fixtures/dragonff-model.dff'))), placement = readIpl(binary()).instances[0];
  const visual = placedModelObjects(model, [], [placement, { ...placement, position: [20, 20, 30] }]);
  const meshes: any[] = []; visual.root.traverse(o => { if ((o as any).isMesh) meshes.push(o); });
  expect(meshes).toHaveLength(2); expect(meshes[0].geometry).toBe(meshes[1].geometry); expect(meshes[0].material).toEqual(meshes[1].material);
  let disposals = 0; meshes[0].geometry.addEventListener('dispose', () => disposals++); visual.dispose(); expect(disposals).toBe(1);
  expect(() => placedModelObjects(model, [], Array(4097).fill(placement))).toThrow('limit');
});

test('archived text IPL padding is ignored and separate placement files take precedence', async () => {
  const { imgFixture } = await import('./fixtures/native-assets');
  const { readImgIndex } = await import('../src/assets/img');
  const { readPlacements } = await import('../src/assets/readPlacements');
  const file = new File([imgFixture([{ name: 'map.ipl', bytes: text('1 house 0 0 0 0 0 0 0 1 -1') }]) as BlobPart], 'map.img');
  const [placementEntry] = await readImgIndex(file);
  const result = await readPlacements({ file, placementEntry });
  expect(result.name).toBe('map.img / map.ipl'); expect(result.ipl.instances).toHaveLength(1);
  const external = await readPlacements({ file, placementEntry, placementFile: new File([text('2 tree 0 10 0 0 0 0 0 1 -1') as BlobPart], 'external.ipl') });
  expect(external.name).toBe('external.ipl'); expect(external.ipl.instances[0].modelId).toBe(2);
  await expect(readPlacements({ file })).rejects.toThrow('Select an IPL');
});
