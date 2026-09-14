import type { DffModel } from './dff';
import { decodeTexture, readTxd, type NativeTexture } from './txd';
import { requireAsset } from './binary';
export interface ModelTexture {
  /** Actual child/parent TXD selected by lookup, scoped to an immutable dataset. */
  sourceDictionary?: string;
  reconstructedMips?:number[];
  name: string; filter: number; addressU: number; addressV: number; hasAlpha: boolean;
  mips: { width: number; height: number; data: Uint8ClampedArray }[];
}
export class TextureDecodeCache {
  dictionaries = new WeakMap<Uint8Array, NativeTexture[]>();
  textures = new WeakMap<NativeTexture, ModelTexture>();
}
export function decodeModelTextures(model: DffModel, bytes: Uint8Array | Uint8Array[], cache?: TextureDecodeCache, dictionaryNames?: readonly string[]): ModelTexture[] {
  return decodeNamedTextures(model.geometries.filter(g => g.uvs.length > 0).flatMap(g => g.materials.map(m => m.texture).filter(Boolean)),bytes,cache,dictionaryNames);
}
/** Named particle/sky rasters use the same source identity, mip decoding and parent resolution as models. */
export function decodeNamedTextures(names:Iterable<string>,bytes:Uint8Array|Uint8Array[],cache?:TextureDecodeCache,dictionaryNames?:readonly string[]):ModelTexture[] {
  const needed = new Set([...names].map(name=>name.toLowerCase()));
  const dictionaries=Array.isArray(bytes)?bytes:[bytes];
  requireAsset(!dictionaryNames || dictionaryNames.length===dictionaries.length && dictionaryNames.every(name=>typeof name==='string'&&name.trim().length>0), 'Texture dictionary provenance must match its sources.');
  const selected: {texture:NativeTexture;sourceDictionary?:string}[] = [], resolved = new Set<string>(); let memory = 0;
  // Dictionaries arrive child first. Parent textures fill only unresolved names.
  for (const [index,dictionary] of dictionaries.entries()) {
    const names = new Set<string>();
    const native = cache?.dictionaries.get(dictionary) ?? readTxd(dictionary);
    cache?.dictionaries.set(dictionary, native);
    for (const texture of native) {
      const name = texture.name.toLowerCase(); if (!needed.has(name) || resolved.has(name)) continue;
      requireAsset(!names.has(name), `Ambiguous duplicate texture: ${texture.name}`); names.add(name);
      selected.push({texture,sourceDictionary:dictionaryNames?.[index].toLowerCase()});
      memory += texture.mips.reduce((n, m) => n + m.width * m.height * 4, 0);
    }
    for (const name of names) resolved.add(name);
  }
  requireAsset(memory <= 64 * 1024 * 1024, 'Referenced texture pixels exceed the 64 MiB preview limit.');
  return selected.map(({texture:t,sourceDictionary}) => {
    const existing = cache?.textures.get(t);
    if (existing) {
      if(existing.sourceDictionary===sourceDictionary)return existing;
      // Never alter a previously published source when another caller supplies
      // a different provenance label (or no label). Pixel storage is immutable.
      const labeled={...existing,sourceDictionary};cache?.textures.set(t,labeled);return labeled;
    }
    const texture: ModelTexture = { sourceDictionary, reconstructedMips:t.mips.flatMap((m,i)=>m.bytes.length===0?[i]:[]), name: t.name, filter: t.filter, addressU: t.addressU, addressV: t.addressV, hasAlpha: t.hasAlpha,
    mips: t.mips.map((m, level) => ({ width: m.width, height: m.height, data: decodeTexture(t, level) })) };
    cache?.textures.set(t, texture); return texture;
  });
}
