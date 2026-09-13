import { readCollisionFile, type ColModel } from './col';
import { readImgIndex, readImgEntry, type ImgEntry } from './img';
import { decodeModelTextures, TextureDecodeCache } from './modelTextures';
import { readDff } from './dff';
import { textureDictionaryChain } from './ide';
export interface ModelRequest { collisionFile?: File; collisionEntry?: ImgEntry; collisionModels?: ColModel[]; file: File; entry?: ImgEntry; textureFile?: File; textureEntry?: ImgEntry; parents?: [string, string][]; }
export class ModelReadCache {
  readonly decode = new TextureDecodeCache();
  private bytes = new Map<number, Uint8Array>();
  private size = 0;
  constructor(readonly file: File, readonly entries: ImgEntry[]) {}
  async dictionary(entry: ImgEntry) {
    const cached = this.bytes.get(entry.offset); if (cached) return cached;
    const bytes = await readImgEntry(this.file, entry);
    // Eviction bounds retained source bytes without restricting scene coverage.
    while (this.size + bytes.byteLength > 64 * 1024 * 1024 && this.bytes.size) {
      const [offset, old] = this.bytes.entries().next().value!; this.bytes.delete(offset); this.size -= old.byteLength;
    }
    this.bytes.set(entry.offset, bytes); this.size += bytes.byteLength; return bytes;
  }
}
export async function readModel(data: ModelRequest, cache?: ModelReadCache) {
  const file = data.file;
  if (cache?.file !== file) cache = undefined;
  const dictionary = (entry: ImgEntry) => cache && cache.file === file ? cache.dictionary(entry) : readImgEntry(file, entry);
  if (!data.entry && file.size > 64 * 1024 * 1024) throw new Error('This model exceeds the 64 MiB import limit.');
  const model = readDff(data.entry ? await readImgEntry(file, data.entry) : new Uint8Array(await file.arrayBuffer()));
  const textureFile: File | undefined = data.textureFile;
  if (textureFile && textureFile.size > 64 * 1024 * 1024) throw new Error('This texture dictionary exceeds the 64 MiB import limit.');
  const textureBytes = textureFile ? new Uint8Array(await textureFile.arrayBuffer()) : data.textureEntry ? await dictionary(data.textureEntry) : null;
  const dictionaries: Uint8Array[] = textureBytes ? [textureBytes] : [];
  const dictionaryNames: string[] = [], notices: string[] = [];
  if (textureBytes) {
    const base = (textureFile?.name ?? data.textureEntry!.name).replace(/\.txd$/i, '').toLowerCase();
    dictionaryNames.push(`${base}.txd`);
    const chain = textureDictionaryChain(base, new Map(data.parents ?? []));
    let sourceMemory = textureBytes.byteLength;
    const entries = data.entry && chain.length > 1 ? (cache?.entries ?? await readImgIndex(file)) : [];
    for (const parent of chain.slice(1)) {
      const entry = entries.find(e => e.name.toLowerCase() === `${parent}.txd`);
      if (!entry) { notices.push(`Missing parent dictionary: ${parent}.txd. Remaining inheritance was not loaded.`); break; }
      sourceMemory += entry.length;
      if (sourceMemory > 64 * 1024 * 1024) throw new Error('Texture dictionary chain exceeds the 64 MiB source limit.');
      dictionaries.push(await dictionary(entry)); dictionaryNames.push(entry.name);
    }
  }
  const textures = dictionaries.length ? decodeModelTextures(model, dictionaries, cache?.decode) : [];
  const collisions = data.collisionModels ?? await readCollisionFile(data.collisionFile, file, data.collisionEntry);
  const name = (data.entry?.name ?? file.name).replace(/\.dff$/i, '').toLowerCase();
  const collision = collisions?.find(c => c.name.toLowerCase() === name);
  if (collisions && !collision) notices.push(`No collision model named ${name} in the selected COL file.`);
  const collisionSource = data.collisionFile?.name ?? (data.collisionEntry ? `${file.name} / ${data.collisionEntry.name}` : undefined);
  return { model, textures, dictionaryNames, notices, collision, collisionSource };
}
