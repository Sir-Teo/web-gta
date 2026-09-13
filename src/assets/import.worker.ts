import { readImgEntry, readImgIndex, type ImgEntry } from './img';
import { decodeTexture, readTxd, type NativeTexture } from './txd';
let source: File | null = null, entries: ImgEntry[] = [], textures: NativeTexture[] = [], revision = 0;
self.onmessage = async ({ data }) => {
  const request = ++revision, { id, action } = data;
  try {
    if (action === 'open') {
      source = data.file; entries = []; textures = [];
      if (!source) throw new Error('Select a local file.');
      if (source.name.toLowerCase().endsWith('.img')) {
        const next = await readImgIndex(source); if (request !== revision) return;
        entries = next; self.postMessage({ id, kind: 'archive', entries }); return;
      }
      if (source.size > 64 * 1024 * 1024) throw new Error('This texture dictionary exceeds the 64 MiB import limit.');
      const bytes = new Uint8Array(await source.arrayBuffer()); if (request !== revision) return;
      textures = readTxd(bytes);
    } else if (action === 'dictionary') {
      if (!source || !Number.isInteger(data.index) || !entries[data.index]) throw new Error('Invalid archive selection.');
      const bytes = await readImgEntry(source, entries[data.index]); if (request !== revision) return;
      textures = readTxd(bytes);
    } else if (action === 'decode') {
      const texture = textures[data.index]; if (!texture) throw new Error('Invalid texture selection.');
      const pixels = decodeTexture(texture, data.level), mip = texture.mips[data.level];
      self.postMessage({ id, kind: 'pixels', width: mip.width, height: mip.height, pixels }, { transfer: [pixels.buffer] }); return;
    } else throw new Error('Unknown import operation.');
    self.postMessage({ id, kind: 'dictionary', textures: textures.map(({ mips, palette, ...metadata }) => ({ ...metadata, levels: mips.map(m => ({ width: m.width, height: m.height, bytes: m.bytes.length })) })) });
  } catch (error) { if (request === revision) self.postMessage({ id, kind: 'error', message: error instanceof Error ? error.message : 'Could not read this asset.' }); }
};
