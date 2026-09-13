// Original diagnostic fixtures authored for this project; no game assets are included.
export function concat(...parts: Uint8Array[]) { const result = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let at = 0; for (const p of parts) { result.set(p, at); at += p.length; } return result; }
function u32(value: number) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, value, true); return b; }
export function chunk(type: number, bytes: Uint8Array) { return concat(u32(type), u32(bytes.length), u32(0x1803ffff), bytes); }
export function textureFixture(options: { name?: string; width?: number; height?: number; format?: number; depth?: number; flags?: number; raster?: number; mips?: Uint8Array[]; palette?: Uint8Array; platform?: number } = {}) {
  const { name = 'calibration_grid', width = 64, height = 64, format = 21, depth = 32, flags = 1, raster = 0x8500, palette, platform = 9 } = options;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) pixels.set((Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? [35, 145, 225, 255] : [180, 75, 40, 255], (y * width + x) * 4);
  const mips = options.mips ?? [pixels, new Uint8Array(Math.max(1, width >> 1) * Math.max(1, height >> 1) * 4).fill(128)];
  const header = new Uint8Array(88), v = new DataView(header.buffer);
  v.setUint32(0, platform, true); v.setUint32(4, 0x1106, true); header.set(new TextEncoder().encode(name).subarray(0, 31), 8);
  v.setUint32(72, raster, true); v.setUint32(76, format, true); v.setUint16(80, width, true); v.setUint16(82, height, true);
  header[84] = depth; header[85] = mips.length; header[86] = 4; header[87] = flags;
  return chunk(0x15, concat(chunk(1, concat(header, palette ?? new Uint8Array(), ...mips.map(m => concat(u32(m.length), m)))), chunk(3, new Uint8Array())));
}
export function txdFixture(...textures: Uint8Array[]) { const header = new Uint8Array(4); new DataView(header.buffer).setUint16(0, textures.length, true); header[2] = 2; return chunk(0x16, concat(chunk(1, header), ...textures, chunk(3, new Uint8Array()))); }
export function imgFixture(files: { name: string; bytes: Uint8Array }[]) {
  const directorySectors = Math.ceil((8 + files.length * 32) / 2048);
  const size = (directorySectors + files.reduce((n, f) => n + Math.ceil(f.bytes.length / 2048), 0)) * 2048;
  const data = new Uint8Array(size), v = new DataView(data.buffer); data.set(new TextEncoder().encode('VER2')); v.setUint32(4, files.length, true);
  let sector = directorySectors;
  files.forEach((file, i) => { const at = 8 + i * 32, sectors = Math.ceil(file.bytes.length / 2048); v.setUint32(at, sector, true); v.setUint16(at + 4, sectors, true); data.set(new TextEncoder().encode(file.name).subarray(0, 24), at + 8); data.set(file.bytes, sector * 2048); sector += sectors; });
  return data;
}
