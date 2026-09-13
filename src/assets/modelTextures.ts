import type { DffModel } from './dff';
import { decodeTexture, readTxd } from './txd';
import { requireAsset } from './binary';
export interface ModelTexture {
  name: string; filter: number; addressU: number; addressV: number; hasAlpha: boolean;
  mips: { width: number; height: number; data: Uint8ClampedArray }[];
}
export function decodeModelTextures(model: DffModel, bytes: Uint8Array | Uint8Array[]): ModelTexture[] {
  const needed = new Set(model.geometries.filter(g => g.uvs.length > 0).flatMap(g => g.materials.map(m => m.texture.toLowerCase()).filter(Boolean)));
  const selected: ReturnType<typeof readTxd> = [], resolved = new Set<string>(); let memory = 0;
  // Dictionaries arrive child first. Parent textures fill only unresolved names.
  for (const dictionary of Array.isArray(bytes) ? bytes : [bytes]) {
    const names = new Set<string>();
    for (const texture of readTxd(dictionary)) {
      const name = texture.name.toLowerCase(); if (!needed.has(name) || resolved.has(name)) continue;
      requireAsset(!names.has(name), `Ambiguous duplicate texture: ${texture.name}`); names.add(name);
      selected.push(texture);
      memory += texture.mips.reduce((n, m) => n + m.width * m.height * 4, 0);
    }
    for (const name of names) resolved.add(name);
  }
  requireAsset(memory <= 64 * 1024 * 1024, 'Referenced texture pixels exceed the 64 MiB preview limit.');
  return selected.map(t => ({ name: t.name, filter: t.filter, addressU: t.addressU, addressV: t.addressV, hasAlpha: t.hasAlpha,
    mips: t.mips.map((m, level) => ({ width: m.width, height: m.height, data: decodeTexture(t, level) })) }));
}
