import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { decodeDxt } from '../src/assets/dxt';
import { readImgEntry, readImgIndex } from '../src/assets/img';
import { decodeTexture, readTxd } from '../src/assets/txd';
import { imgFixture, textureFixture, txdFixture } from './fixtures/native-assets';
const pixel = (data: Uint8ClampedArray, index: number) => [...data.slice(index * 4, index * 4 + 4)];

test('DXT1 preserves endpoint order, interpolation, transparency and partial blocks', () => {
  const opaque = new Uint8Array([0, 248, 224, 7, 228, 228, 228, 228]);
  const decoded = decodeDxt(opaque, 4, 4, 'DXT1');
  expect(pixel(decoded, 0)).toEqual([255, 0, 0, 255]); expect(pixel(decoded, 1)).toEqual([0, 255, 0, 255]);
  expect(pixel(decoded, 2)).toEqual([170, 85, 0, 255]); expect(pixel(decoded, 3)).toEqual([85, 170, 0, 255]);
  const transparent = new Uint8Array([0, 0, 255, 255, 255, 255, 255, 255]);
  expect([...decodeDxt(transparent, 1, 1, 'DXT1')]).toEqual([0, 0, 0, 0]);
  expect(() => decodeDxt(opaque.slice(0, 7), 4, 4, 'DXT1')).toThrow('mip');
});
test('DXT3 and both DXT5 alpha modes decode explicit and crossing-byte indices', () => {
  const block = new Uint8Array(16); block.set([0, 248, 224, 7, 0, 0, 0, 0], 8);
  for (let i = 0; i < 8; i++) block[i] = (i * 2) | (i * 2 + 1) << 4;
  const dxt3 = decodeDxt(block, 4, 4, 'DXT3'); for (let i = 0; i < 16; i++) expect(dxt3[i * 4 + 3]).toBe(i * 17);
  for (const [a, b, expected] of [[210, 0, [210, 0, 180, 150, 120, 90, 60, 30]], [0, 200, [0, 200, 40, 80, 120, 160, 0, 255]]] as const) {
    block.fill(0, 0, 8); block[0] = a; block[1] = b;
    let bits = 0n; for (let i = 0; i < 16; i++) bits |= BigInt(i % 8) << BigInt(i * 3);
    for (let i = 0; i < 6; i++) block[i + 2] = Number((bits >> BigInt(i * 8)) & 255n);
    const decoded = decodeDxt(block, 4, 4, 'DXT5'); for (let i = 0; i < 16; i++) expect(pixel(decoded, i)).toEqual([255, 0, 0, expected[i % 8]]);
  }
});
test('TXD retains native mip pixels, names, alpha and sampling metadata', () => {
  const [t] = readTxd(txdFixture(textureFixture()));
  expect(t.name).toBe('calibration_grid'); expect(t.mips).toHaveLength(2); expect(t.filter).toBe(6); expect(t.addressU).toBe(1); expect(t.hasAlpha).toBe(true);
  expect(pixel(decodeTexture(t), 0)).toEqual([40, 75, 180, 255]);
  expect(pixel(decodeTexture(t, 1), 0)).toEqual([128, 128, 128, 128]);
  expect(() => decodeTexture(t, 2)).toThrow('mip');
});
test('uncompressed RGB rows, packed color and palette alpha retain exact channels', () => {
  const cases = [
    { format: 20, depth: 24, bytes: [9, 20, 30, 0], expected: [30, 20, 9, 255] },
    { format: 22, depth: 32, bytes: [9, 20, 30, 0], expected: [30, 20, 9, 255] },
    { format: 23, depth: 16, bytes: [0, 248], expected: [255, 0, 0, 255] },
    { format: 25, depth: 16, bytes: [0, 124], expected: [255, 0, 0, 0] },
    { format: 26, depth: 16, bytes: [35, 129], expected: [17, 34, 51, 136] },
  ];
  for (const c of cases) {
    const [t] = readTxd(txdFixture(textureFixture({ width: 1, height: 1, format: c.format, depth: c.depth, mips: [new Uint8Array(c.bytes)] })));
    expect(pixel(decodeTexture(t), 0)).toEqual(c.expected);
  }
  const palette = new Uint8Array(1024); palette.set([10, 20, 30, 40], 28);
  const [t] = readTxd(txdFixture(textureFixture({ width: 1, height: 1, format: 41, depth: 8, raster: 0x2500, palette, mips: [new Uint8Array([7])] })));
  expect(pixel(decodeTexture(t), 0)).toEqual([10, 20, 30, 40]);
});
test('malformed chunks, count mismatches, oversized textures and unsupported platforms fail explicitly', () => {
  const valid = txdFixture(textureFixture({ width: 4, height: 4 }));
  for (let i = 0; i < valid.length; i++) expect(() => readTxd(valid.slice(0, i))).toThrow();
  const badCount = valid.slice(); new DataView(badCount.buffer).setUint16(24, 3, true); expect(() => readTxd(badCount)).toThrow('count');
  expect(() => readTxd(txdFixture(textureFixture({ platform: 8 })))).toThrow('platform');
  expect(() => readTxd(txdFixture(textureFixture({ flags: 2 })))).toThrow('Cube');
  expect(() => readTxd(txdFixture(textureFixture({ raster: 0x4500 })))).toThrow('4-bit');
  const giant = valid.slice(); new DataView(giant.buffer).setUint16(132, 65535, true); expect(() => readTxd(giant)).toThrow();
});
test('IMG reads only its index and selected file range, preserving sector padding', async () => {
  const txd = txdFixture(textureFixture({ width: 4, height: 4 })), bytes = imgFixture([{ name: 'test.txd', bytes: txd }, { name: 'unused.dff', bytes: new Uint8Array(100) }]);
  const reads: [number, number][] = [];
  class ObservedBlob extends Blob { override slice(start = 0, end = this.size) { reads.push([start, end]); return super.slice(start, end); } }
  const file = new ObservedBlob([bytes]), entries = await readImgIndex(file);
  expect(reads).toEqual([[0, 8], [8, 72]]); expect(entries[0].offset).toBe(2048);
  expect(readTxd(await readImgEntry(file, entries[0]))[0].name).toBe('calibration_grid');
  expect(reads[2]).toEqual([2048, 4096]);
});
test('IMG rejects overlapping, duplicate, out-of-file and invalid directory entries', async () => {
  const base = imgFixture([{ name: 'a.txd', bytes: new Uint8Array(5) }, { name: 'b.txd', bytes: new Uint8Array(5) }]);
  for (const modify of [
    (v: DataView) => v.setUint32(4, 200001, true),
    (v: DataView) => v.setUint32(8, 99, true),
    (v: DataView) => v.setUint32(40, 1, true),
    (v: DataView) => v.setUint8(48, 97),
    (v: DataView) => v.setUint8(16, 47),
  ]) { const bytes = base.slice(); modify(new DataView(bytes.buffer)); await expect(readImgIndex(new Blob([bytes]))).rejects.toThrow(); }
});


test('reads an independently generated DragonFF dictionary without our fixture writer', () => {
  const textures = readTxd(new Uint8Array(readFileSync(new URL('./fixtures/dragonff-diagnostic.txd', import.meta.url))));
  expect(textures.map(t => t.name)).toEqual(['independent_rgba', 'independent_dxt1']);
  expect(textures[0].addressU).toBe(2); expect(textures[0].addressV).toBe(1);
  expect(pixel(decodeTexture(textures[0]), 1)).toEqual([40, 50, 60, 128]);
  expect(pixel(decodeTexture(textures[1]), 3)).toEqual([85, 170, 0, 255]);
});
