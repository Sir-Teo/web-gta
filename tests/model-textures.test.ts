import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import * as THREE from 'three';
import { readDff } from '../src/assets/dff';
import { decodeModelTextures } from '../src/assets/modelTextures';
import { nativeTexture } from '../src/assets/nativeTexture';
import { modelObject } from '../src/assets/ModelPreview';
import { textureFixture, txdFixture } from './fixtures/native-assets';
const model = () => readDff(new Uint8Array(readFileSync(new URL('./fixtures/dragonff-model.dff', import.meta.url))));

test('name resolution selects referenced textures without case sensitivity and retains source mips', () => {
  const textures = decodeModelTextures(model(), txdFixture(textureFixture({ name: 'CALIBRATION_GRID' }), textureFixture({ name: 'unused' })));
  expect(textures).toHaveLength(1); expect(textures[0].mips).toHaveLength(2);
  expect([...textures[0].mips[0].data.slice(0, 4)]).toEqual([40, 75, 180, 255]);
  expect(textures[0].mips[1].width).toBe(32);
  expect(() => decodeModelTextures(model(), txdFixture(textureFixture(), textureFixture({ name: 'CALIBRATION_GRID' })))).toThrow('duplicate');
});
test('native GPU textures preserve row order, source mip data and sampler modes', () => {
  const [source] = decodeModelTextures(model(), txdFixture(textureFixture()));
  const fallback = nativeTexture({ ...source, filter: 0 });
  expect(fallback.minFilter).toBe(THREE.LinearFilter); fallback.dispose();
  for (let filter = 1; filter <= 6; filter++) {
    const map = nativeTexture({ ...source, filter, addressU: 2, addressV: 0 });
    expect(map.flipY).toBe(false); expect(map.generateMipmaps).toBe(false);
    expect(map.mipmaps).toBe(source.mips); expect(map.colorSpace).toBe(THREE.NoColorSpace);
    expect(map.wrapS).toBe(THREE.MirroredRepeatWrapping); expect(map.wrapT).toBe(THREE.MirroredRepeatWrapping);
    expect(map.minFilter).toBe([THREE.NearestFilter, THREE.LinearFilter, THREE.NearestMipmapNearestFilter, THREE.NearestMipmapLinearFilter, THREE.LinearMipmapNearestFilter, THREE.LinearMipmapLinearFilter][filter - 1]);
    map.dispose();
  }
});
test('materials share dictionary textures, preserve alpha and release the GPU texture once', () => {
  const m = model(); m.geometries[0].materials[1].texture = 'CALIBRATION_GRID';
  const textures = decodeModelTextures(m, txdFixture(textureFixture())), visual = modelObject(m, textures);
  const mesh = visual.root.getObjectByName('rotated_pyramid')!.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial[]>;
  expect(mesh.material[0].map).not.toBeNull(); expect(mesh.material[1].map).toBe(mesh.material[0].map);
  expect(mesh.material[0].transparent).toBe(true); expect(mesh.material[0].depthWrite).toBe(false);
  let disposed = 0; mesh.material[0].map!.addEventListener('dispose', () => disposed++); visual.dispose(); expect(disposed).toBe(1);
});


test('independent model and companion dictionary preserve asymmetric rows and full mip chain', () => {
  const [texture] = decodeModelTextures(model(), new Uint8Array(readFileSync(new URL('./fixtures/dragonff-model-textures.txd', import.meta.url))));
  expect(texture.mips.map(m => [m.width, m.height])).toEqual([[4, 4], [2, 2], [1, 1]]);
  expect([...texture.mips[0].data.slice(0, 4)]).toEqual([255, 0, 0, 255]);
  expect([...texture.mips[0].data.slice(32, 36)]).toEqual([0, 0, 255, 255]);
  expect(texture.hasAlpha).toBe(false);
});

test('child dictionary textures override ancestors while missing names inherit parent pixels', () => {
  const child = txdFixture(textureFixture({ name: 'calibration_grid' }));
  const parent = new Uint8Array(readFileSync(new URL('./fixtures/dragonff-model-textures.txd', import.meta.url)));
  const overridden = decodeModelTextures(model(), [child, parent]);
  expect([...overridden[0].mips[0].data.slice(0, 4)]).toEqual([40, 75, 180, 255]);
  const inherited = decodeModelTextures(model(), [txdFixture(textureFixture({ name: 'unrelated' })), parent]);
  expect([...inherited[0].mips[0].data.slice(0, 4)]).toEqual([255, 0, 0, 255]);
  expect(inherited).toHaveLength(1);
});

test('decode cache shares a source raster across models without conflating equal names in separate dictionaries', async () => {
  const { TextureDecodeCache } = await import('../src/assets/modelTextures');
  const cache = new TextureDecodeCache(), child = txdFixture(textureFixture());
  const independent = new Uint8Array(readFileSync('tests/fixtures/dragonff-model-textures.txd'));
  const first = decodeModelTextures(model(), child, cache)[0], second = decodeModelTextures(model(), child, cache)[0];
  expect(first).toBe(second);
  const other = decodeModelTextures(model(), independent, cache)[0];
  expect(other).not.toBe(first); expect([...other.mips[0].data.slice(0, 4)]).toEqual([255, 0, 0, 255]);
  expect(decodeModelTextures(model(), [txdFixture(textureFixture({ name: 'unused' })), independent], cache)[0]).toBe(other);
});
test('shared GPU raster remains live until the last model owner releases it', async () => {
  const { TexturePool } = await import('../src/assets/TexturePool');
  const pool = new TexturePool(), textures = decodeModelTextures(model(), txdFixture(textureFixture()));
  const a = modelObject(model(), textures, undefined, pool), b = modelObject(model(), textures, undefined, pool);
  const mesh = (root: THREE.Group) => root.getObjectByName('rotated_pyramid')!.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial[]>;
  const map = mesh(a.root).material[0].map!; expect(map).toBe(mesh(b.root).material[0].map);
  let disposed = 0; map.addEventListener('dispose', () => disposed++);
  a.dispose(); a.dispose(); expect(disposed).toBe(0); b.dispose(); expect(disposed).toBe(1);
  const other = decodeModelTextures(model(), txdFixture(textureFixture()));
  const c = modelObject(model(), other, undefined, pool); expect(mesh(c.root).material[0].map).not.toBe(map); c.dispose();
});
