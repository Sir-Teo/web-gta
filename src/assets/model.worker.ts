import { readPlacements } from './readPlacements';
import { readModel } from './readModel';
import { readScene } from './scene';
import { matchingPlacements } from './ipl';
import { readIdeAssociations, mergeIdeAssociations, readIdeParents, mergeIdeParents } from './ide';
import { readImgIndex } from './img';
self.onmessage = async ({ data }) => {
  try {
    if (data.action === 'scene') {
      const result = await readScene(data), transfer = new Set<ArrayBuffer>();
      for (const part of result.scene) {
        for (const g of part.model.geometries) for (const a of [g.positions, g.normals, g.colors, g.nightColors, g.indices, g.materialIds, ...g.uvs]) if (a) transfer.add(a.buffer as ArrayBuffer);
        for (const t of part.textures) for (const mip of t.mips) transfer.add(mip.data.buffer as ArrayBuffer);
      }
      self.postMessage(result, { transfer: [...transfer] }); return;
    }
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
    const { model, textures, dictionaryNames, notices, collision } = await readModel(data);
    let placements;
    let placementSource;
    if (data.placementFile || data.placementEntry) {
      const source = await readPlacements(data), ipl = source.ipl; placementSource = source.name;
      const modelName = (data.entry?.name ?? file.name).replace(/\.dff$/i, '');
      placements = matchingPlacements(ipl, modelName, data.modelId, data.interior);
      if (!placements.length) throw new Error(`No placements for ${modelName} in interior ${data.interior}.`);
      notices.push(...ipl.warnings, 'Only this model is placed. LOD links are retained but not resolved.');
    }
    const buffers = new Set<ArrayBuffer>();
    for (const g of model.geometries) for (const a of [g.positions, g.normals, g.colors, g.nightColors, g.indices, g.materialIds, ...g.uvs]) if (a) buffers.add(a.buffer as ArrayBuffer);
    for (const t of textures) for (const mip of t.mips) buffers.add(mip.data.buffer as ArrayBuffer);
    self.postMessage({ model, textures, dictionaryNames, notices, placements, placementSource, collision }, { transfer: [...buffers] });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Could not read the model.' }); }
};
