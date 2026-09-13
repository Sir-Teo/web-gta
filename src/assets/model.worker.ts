import { readDff } from './dff';
self.onmessage = async ({ data }) => {
  try {
    const file: File = data.file;
    if (file.size > 64 * 1024 * 1024) throw new Error('This model exceeds the 64 MiB import limit.');
    const model = readDff(new Uint8Array(await file.arrayBuffer()));
    const buffers = new Set<ArrayBuffer>();
    for (const g of model.geometries) for (const a of [g.positions, g.normals, g.colors, g.nightColors, g.indices, g.materialIds, ...g.uvs]) if (a) buffers.add(a.buffer as ArrayBuffer);
    self.postMessage({ model }, { transfer: [...buffers] });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Could not read the model.' }); }
};
