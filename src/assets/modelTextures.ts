import type { DffModel } from './dff';
import { decodeTexture, readTxd, type NativeTexture } from './txd';
import { requireAsset } from './binary';
import type { DxtFormat } from './dxt';
export interface ModelTexture {
  /** Actual child/parent TXD selected by lookup, scoped to an immutable dataset. */
  sourceDictionary?: string;
  reconstructedMips?:number[];
  /** The raster's DXT format when its mips hold the blocks as stored, for a compressed upload
   * (D3D9 samples SA's DXT rasters compressed); absent when the mips hold RGBA8 pixels. */
  compressed?: DxtFormat;
  /** Absent tiny DXT levels left off the end of a compressed mip chain. */
  droppedMips?: number[];
  name: string; filter: number; addressU: number; addressV: number; hasAlpha: boolean;
  mips: { width: number; height: number; data: Uint8ClampedArray }[];
}
const pixelStorage = (texture: ModelTexture) => texture.mips.reduce((n, m) => n + m.data.byteLength, 0);
/** A dictionary's parsed rasters; remembers which dictionary each raster came from. */
class DictionaryRasters extends WeakMap<Uint8Array, NativeTexture[]> {
  constructor(private readonly owners: WeakMap<NativeTexture, Uint8Array>) { super(); }
  override set(bytes: Uint8Array, natives: NativeTexture[]) { for (const native of natives) this.owners.set(native, bytes); return super.set(bytes, natives); }
}
/** Decoded rasters; keeps the pixel total of each owning dictionary current as they are stored or replaced. */
class DecodedRasters extends WeakMap<NativeTexture, ModelTexture> {
  constructor(private readonly owners: WeakMap<NativeTexture, Uint8Array>, private readonly pixels: WeakMap<Uint8Array, number>) { super(); }
  private adjust(native: NativeTexture, delta: number) { const owner = this.owners.get(native); if (owner && delta) this.pixels.set(owner, (this.pixels.get(owner) ?? 0) + delta); }
  override set(native: NativeTexture, texture: ModelTexture) { const before = this.get(native); this.adjust(native, pixelStorage(texture) - (before ? pixelStorage(before) : 0)); return super.set(native, texture); }
  override delete(native: NativeTexture) { const before = this.get(native); if (before) this.adjust(native, -pixelStorage(before)); return super.delete(native); }
}
export class TextureDecodeCache {
  private readonly owners = new WeakMap<NativeTexture, Uint8Array>();
  /** Decoded pixel bytes held in `textures` per dictionary: ModelReadCache.trimDecoded runs after every model
   * read, and summing every raster's mips there each time cost seconds per streamed window. */
  readonly pixelBytes = new WeakMap<Uint8Array, number>();
  dictionaries: WeakMap<Uint8Array, NativeTexture[]> = new DictionaryRasters(this.owners);
  textures: WeakMap<NativeTexture, ModelTexture> = new DecodedRasters(this.owners, this.pixelBytes);
  /** Keep DXT rasters compressed instead of decoding them to RGBA8: an eighth (DXT1) or a quarter
   * (DXT3/5) of the memory, and no decode work. Only for textures bound for upload, not CPU reads. */
  constructor(readonly compressed = false) {}
}
export function decodeModelTextures(model: DffModel, bytes: Uint8Array | Uint8Array[], cache?: TextureDecodeCache, dictionaryNames?: readonly string[]): ModelTexture[] {
  // A material's MatFX env texture (vehicle reflections, some glass) is looked up in the same dictionary chain.
  return decodeNamedTextures(model.geometries.filter(g => g.uvs.length > 0).flatMap(g => g.materials.flatMap(m => [m.texture, m.envMap?.texture ?? '']).filter(Boolean)),bytes,cache,dictionaryNames);
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
    const absent = t.mips.flatMap((m,i)=>m.bytes.length===0?[i]:[]), common = { sourceDictionary, name: t.name, filter: t.filter, addressU: t.addressU, addressV: t.addressV, hasAlpha: t.hasAlpha };
    // A compressed chain stops before its first absent level; the stored blocks are copied out of the dictionary.
    const texture: ModelTexture = cache?.compressed && t.format.startsWith('DXT')
      ? { ...common, compressed: t.format as DxtFormat, droppedMips: absent, mips: t.mips.slice(0, absent[0] ?? t.mips.length).map(m => ({ width: m.width, height: m.height, data: new Uint8ClampedArray(m.bytes) })) }
      : { ...common, reconstructedMips: absent, mips: t.mips.map((m, level) => ({ width: m.width, height: m.height, data: decodeTexture(t, level) })) };
    cache?.textures.set(t, texture); return texture;
  });
}
