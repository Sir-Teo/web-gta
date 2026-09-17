import type {ModelGeometryCache} from './ModelGeometryCache';
import { requireAsset } from './binary';
import { readCollisionFile, type ColModel } from './col';
import { readImgIndex, readImgEntry, type ImgEntry } from './img';
import { decodeModelTextures, TextureDecodeCache } from './modelTextures';
import { readDff } from './dff';
import { textureDictionaryChain } from './ide';
export interface ModelRequest { modelFile?: File; clumpIndex?: number; collisionFile?: File; collisionEntry?: ImgEntry; collisionModels?: ColModel[]; file: File; entry?: ImgEntry; textureFile?: File; textureEntry?: ImgEntry; parents?: [string, string][]; }
export class ModelReadCache {
  readonly decode = new TextureDecodeCache();
  private bytes = new Map<number | File, Uint8Array>();
  private size = 0;
  private pending = new Map<number | File, Promise<Uint8Array>>();
  readonly externalDictionaries = new Map<string, File>();
  constructor(readonly file: File, readonly entries: ImgEntry[], external: File[] = [],readonly geometry?:ModelGeometryCache) {
    requireAsset(external.length <= 256 && external.reduce((sum, file) => sum + file.size, 0) <= 128 * 1024 * 1024, 'External scene dictionaries exceed the 256-file or 128 MiB limit.');
    for (const dictionary of external) {
      const name = dictionary.name.toLowerCase();
      requireAsset(name.endsWith('.txd') && name.length > 4 && dictionary.size <= 64 * 1024 * 1024, `Invalid external dictionary: ${dictionary.name}.`);
      requireAsset(!this.externalDictionaries.has(name), `Ambiguous external dictionary: ${dictionary.name}.`);
      this.externalDictionaries.set(name, dictionary);
    }
  }
  matches(file: File, external: File[] = []) {
    return this.file === file && external.length === this.externalDictionaries.size && external.every(file => this.externalDictionaries.get(file.name.toLowerCase()) === file);
  }
  /** Bound source bytes plus decoded pixels across successive world windows.
   * Weak decode keys let evicted dictionary pixels die once scenes release them. */
  trimDecoded() {
    const costs = [...this.bytes].map(([key, bytes]) => {
      let cost = bytes.byteLength;
      for (const native of this.decode.dictionaries.get(bytes) ?? []) {
        for (const mip of this.decode.textures.get(native)?.mips ?? []) cost += mip.data.byteLength;
      }
      return {key, bytes, cost};
    });
    let retained = costs.reduce((sum, entry) => sum + entry.cost, 0);
    for (const entry of costs) {
      if (retained <= 64 * 1024 * 1024) break;
      this.bytes.delete(entry.key); this.size -= entry.bytes.byteLength; retained -= entry.cost;
    }
    return {dictionaries: this.bytes.size, retainedBytes: retained, pending: this.pending.size};
  }
  async dictionaryFile(file: File) {
    const cached = this.bytes.get(file); if (cached) { this.bytes.delete(file); this.bytes.set(file, cached); return cached; }
    requireAsset(file.size <= 64 * 1024 * 1024, 'This texture dictionary exceeds the 64 MiB import limit.');
    return this.load(file, async () => new Uint8Array(await file.arrayBuffer()));
  }
  private async load(key: number | File, read: () => Promise<Uint8Array>) {
    const existing = this.pending.get(key); if (existing) return existing;
    const task = read().then(bytes => this.retain(key, bytes));
    this.pending.set(key, task);
    try { return await task; } finally { this.pending.delete(key); }
  }
  private retain(key: number | File, bytes: Uint8Array) {
    while (this.size + bytes.byteLength > 64 * 1024 * 1024 && this.bytes.size) {
      const [oldKey, old] = this.bytes.entries().next().value!; this.bytes.delete(oldKey); this.size -= old.byteLength;
    }
    this.bytes.set(key, bytes); this.size += bytes.byteLength; return bytes;
  }
  async dictionary(entry: ImgEntry) {
    const cached = this.bytes.get(entry.offset); if (cached) { this.bytes.delete(entry.offset); this.bytes.set(entry.offset, cached); return cached; }
    // Coalesce models sharing a TXD so they also share decoded pixel identity.
    return this.load(entry.offset, () => readImgEntry(this.file, entry));
  }
}
export async function readModel(data: ModelRequest, cache?: ModelReadCache) {
  const file = data.file;
  if (cache?.file !== file) cache = undefined;
  const dictionary = (entry: ImgEntry) => cache && cache.file === file ? cache.dictionary(entry) : readImgEntry(file, entry);
  if ((data.modelFile?.size ?? (!data.entry ? file.size : 0)) > 64 * 1024 * 1024) throw new Error('This model exceeds the 64 MiB import limit.');
  const dictionaryNames: string[] = [], notices: string[] = [];
  const modelBytes = data.modelFile ? new Uint8Array(await data.modelFile.arrayBuffer()) : data.entry ? await readImgEntry(file, data.entry) : new Uint8Array(await file.arrayBuffer());
  let model;
  try {
    model = cache?.geometry?.file===file?await cache.geometry.read(data.entry,data.modelFile,data.clumpIndex):readDff(modelBytes, data.clumpIndex);
  } catch (error) {
    // Corrupt-depot repair pass: retry once with non-finite coordinates zeroed.
    if (!(error instanceof Error) || !error.message.includes('Non-finite model coordinate')) throw error;
    model = readDff(modelBytes, data.clumpIndex, true);
    notices.push(`Repaired corrupt model coordinates (non-finite values zeroed): ${model.warnings.filter(w=>w.startsWith('Repaired')).join('; ')||'see model warnings'}.`);
  }
  const textureFile: File | undefined = data.textureFile;
  if (textureFile && textureFile.size > 64 * 1024 * 1024) throw new Error('This texture dictionary exceeds the 64 MiB import limit.');
  const textureBytes = textureFile ? (cache ? await cache.dictionaryFile(textureFile) : new Uint8Array(await textureFile.arrayBuffer())) : data.textureEntry ? await dictionary(data.textureEntry) : null;
  const dictionaries: Uint8Array[] = textureBytes ? [textureBytes] : [];
  if (textureBytes) {
    const base = (textureFile?.name ?? data.textureEntry!.name).replace(/\.txd$/i, '').toLowerCase();
    dictionaryNames.push(`${base}.txd`);
    const chain = textureDictionaryChain(base, new Map(data.parents ?? []));
    let sourceMemory = textureBytes.byteLength;
    const entries = chain.length > 1 ? (cache?.entries ?? (data.entry ? await readImgIndex(file) : [])) : [];
    for (const parent of chain.slice(1)) {
      const external = cache?.externalDictionaries.get(`${parent}.txd`);
      const entry = entries.find(e => e.name.toLowerCase() === `${parent}.txd`);
      if (!external && !entry) { notices.push(`Missing parent dictionary: ${parent}.txd. Remaining inheritance was not loaded.`); break; }
      sourceMemory += external?.size ?? entry!.length;
      if (sourceMemory > 64 * 1024 * 1024) throw new Error('Texture dictionary chain exceeds the 64 MiB source limit.');
      dictionaries.push(external ? await cache!.dictionaryFile(external) : await dictionary(entry!)); dictionaryNames.push(external?.name ?? entry!.name);
    }
  }
  const textures = dictionaries.length ? decodeModelTextures(model, dictionaries, cache?.decode, dictionaryNames) : [];
  cache?.trimDecoded();
  const collisions = data.collisionModels ?? await readCollisionFile(data.collisionFile, file, data.collisionEntry) ?? model.embeddedCollisions;
  const name = (data.modelFile?.name ?? data.entry?.name ?? file.name).replace(/\.dff$/i, '').toLowerCase();
  // An embedded singleton belongs to its selected clump. Native vehicle COL
  // labels (for example greenwoo_col) need not match the DFF filename.
  const embedded=!!model.embeddedCollisions&&collisions===model.embeddedCollisions;
  const collision = embedded&&collisions!.length===1?collisions![0]:collisions?.find(c => c.name.toLowerCase() === name);
  if (collisions && !collision) notices.push(`No collision model named ${name} in the selected COL file.`);
  for(const texture of textures)if(texture.reconstructedMips?.length)notices.push(`${texture.name}: reconstructed absent tiny DXT mip levels ${texture.reconstructedMips.join(', ')} from the preceding level; original tail pixels unavailable.`);
  const collisionSource = data.collisionFile?.name ?? (data.collisionEntry ? `${file.name} / ${data.collisionEntry.name}` : collisions===model.embeddedCollisions&&collision ? `${data.modelFile?.name??data.entry?.name??file.name} / embedded COL` : undefined);
  return { model, textures, dictionaryNames, notices, collision, collisionSource };
}
