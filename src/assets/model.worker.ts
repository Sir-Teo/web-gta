import { readIpl, matchingPlacements } from './ipl';
import { readIdeAssociations, mergeIdeAssociations, readIdeParents, mergeIdeParents, textureDictionaryChain } from './ide';
import { readImgIndex, readImgEntry } from './img';
import { decodeModelTextures } from './modelTextures';
import { readDff } from './dff';
self.onmessage = async ({ data }) => {
  try {
    if (data.action === 'ide') {
      const files: File[] = data.files;
      if (files.length > 100 || files.reduce((size, file) => size + file.size, 0) > 4 * 1024 * 1024) throw new Error('IDE selection exceeds 100 files or 4 MiB.');
      const records = [], parentRecords: [string, string][] = [];
      for (const file of files) {
        const text = new TextDecoder('windows-1252').decode(await file.arrayBuffer());
        records.push(...readIdeAssociations(text)); parentRecords.push(...readIdeParents(text));
      }
      self.postMessage({ associations: [...mergeIdeAssociations(records)], parents: [...mergeIdeParents(parentRecords)] }); return;
    }
    const file: File = data.file;
    if (data.action === 'index') { self.postMessage({ entries: await readImgIndex(file) }); return; }
    if (!data.entry && file.size > 64 * 1024 * 1024) throw new Error('This model exceeds the 64 MiB import limit.');
    const model = readDff(data.entry ? await readImgEntry(file, data.entry) : new Uint8Array(await file.arrayBuffer()));
    const textureFile: File | undefined = data.textureFile;
    if (textureFile && textureFile.size > 64 * 1024 * 1024) throw new Error('This texture dictionary exceeds the 64 MiB import limit.');
    const textureBytes = textureFile ? new Uint8Array(await textureFile.arrayBuffer()) : data.textureEntry ? await readImgEntry(file, data.textureEntry) : null;
    const dictionaries: Uint8Array[] = textureBytes ? [textureBytes] : [];
    const dictionaryNames: string[] = [], notices: string[] = [];
    if (textureBytes) {
      const base = (textureFile?.name ?? data.textureEntry.name).replace(/\.txd$/i, '').toLowerCase();
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
    let placements;
    if (data.placementFile) {
      const placementFile: File = data.placementFile;
      if (placementFile.size > 64 * 1024 * 1024) throw new Error('IPL exceeds the 64 MiB source limit.');
      const ipl = readIpl(new Uint8Array(await placementFile.arrayBuffer()));
      const modelName = (data.entry?.name ?? file.name).replace(/\.dff$/i, '');
      placements = matchingPlacements(ipl, modelName, data.modelId, data.interior);
      if (!placements.length) throw new Error(`No placements for ${modelName} in interior ${data.interior}.`);
      notices.push(...ipl.warnings, 'Only this model is placed. LOD links are retained but not resolved.');
    }
    const buffers = new Set<ArrayBuffer>();
    for (const g of model.geometries) for (const a of [g.positions, g.normals, g.colors, g.nightColors, g.indices, g.materialIds, ...g.uvs]) if (a) buffers.add(a.buffer as ArrayBuffer);
    for (const t of textures) for (const mip of t.mips) buffers.add(mip.data.buffer as ArrayBuffer);
    self.postMessage({ model, textures, dictionaryNames, notices, placements }, { transfer: [...buffers] });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Could not read the model.' }); }
};
