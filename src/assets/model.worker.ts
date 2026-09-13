import { readImgIndex, readImgEntry } from './img';
import { decodeModelTextures } from './modelTextures';
import { readDff } from './dff';
self.onmessage = async ({ data }) => {
  try {
    const file: File = data.file;
    if (data.action === 'index') { self.postMessage({ entries: await readImgIndex(file) }); return; }
    if (!data.entry && file.size > 64 * 1024 * 1024) throw new Error('This model exceeds the 64 MiB import limit.');
    const model = readDff(data.entry ? await readImgEntry(file, data.entry) : new Uint8Array(await file.arrayBuffer()));
    const textureFile: File | undefined = data.textureFile;
    if (textureFile && textureFile.size > 64 * 1024 * 1024) throw new Error('This texture dictionary exceeds the 64 MiB import limit.');
    const textureBytes = textureFile ? new Uint8Array(await textureFile.arrayBuffer()) : data.textureEntry ? await readImgEntry(file, data.textureEntry) : null;
    const textures = textureBytes ? decodeModelTextures(model, textureBytes) : [];
    const buffers = new Set<ArrayBuffer>();
    for (const g of model.geometries) for (const a of [g.positions, g.normals, g.colors, g.nightColors, g.indices, g.materialIds, ...g.uvs]) if (a) buffers.add(a.buffer as ArrayBuffer);
    for (const t of textures) for (const mip of t.mips) buffers.add(mip.data.buffer as ArrayBuffer);
    self.postMessage({ model, textures }, { transfer: [...buffers] });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Could not read the model.' }); }
};
