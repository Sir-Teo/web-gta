import { readImgIndex, readImgEntry, type ImgEntry } from './img';
import { decodeModelTextures } from './modelTextures';
import { readDff } from './dff';
import { textureDictionaryChain } from './ide';
export interface ModelRequest { file: File; entry?: ImgEntry; textureFile?: File; textureEntry?: ImgEntry; parents?: [string, string][]; }
export async function readModel(data: ModelRequest) {
  const file = data.file;
    if (!data.entry && file.size > 64 * 1024 * 1024) throw new Error('This model exceeds the 64 MiB import limit.');
    const model = readDff(data.entry ? await readImgEntry(file, data.entry) : new Uint8Array(await file.arrayBuffer()));
    const textureFile: File | undefined = data.textureFile;
    if (textureFile && textureFile.size > 64 * 1024 * 1024) throw new Error('This texture dictionary exceeds the 64 MiB import limit.');
    const textureBytes = textureFile ? new Uint8Array(await textureFile.arrayBuffer()) : data.textureEntry ? await readImgEntry(file, data.textureEntry) : null;
    const dictionaries: Uint8Array[] = textureBytes ? [textureBytes] : [];
    const dictionaryNames: string[] = [], notices: string[] = [];
    if (textureBytes) {
      const base = (textureFile?.name ?? data.textureEntry!.name).replace(/\.txd$/i, '').toLowerCase();
      dictionaryNames.push(`${base}.txd`);
      const chain = textureDictionaryChain(base, new Map(data.parents ?? []));
      let sourceMemory = textureBytes.byteLength;
      const entries = data.entry && chain.length > 1 ? await readImgIndex(file) : [];
      for (const parent of chain.slice(1)) {
        const entry = entries.find(e => e.name.toLowerCase() === `${parent}.txd`);
        if (!entry) { notices.push(`Missing parent dictionary: ${parent}.txd. Remaining inheritance was not loaded.`); break; }
        sourceMemory += entry.length;
        if (sourceMemory > 64 * 1024 * 1024) throw new Error('Texture dictionary chain exceeds the 64 MiB source limit.');
        dictionaries.push(await readImgEntry(file, entry)); dictionaryNames.push(entry.name);
      }
    }
    const textures = dictionaries.length ? decodeModelTextures(model, dictionaries) : [];
  return { model, textures, dictionaryNames, notices };
}
