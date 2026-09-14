import { BinaryReader, readChunk, requireAsset } from './binary';
import { decodeDxt, type DxtFormat } from './dxt';
export interface TextureMip { width: number; height: number; bytes: Uint8Array }
export interface NativeTexture {
  name: string; mask: string; version: number; width: number; height: number; depth: number;
  filter: number; addressU: number; addressV: number; hasAlpha: boolean; format: string;
  rasterFormat: number; d3dFormat: number; palette?: Uint8Array; mips: TextureMip[];
}
const formats = new Map<number, string>([[0x31545844, 'DXT1'], [0x33545844, 'DXT3'], [0x35545844, 'DXT5'],
  [20, 'RGB888'], [21, 'ARGB8888'], [22, 'XRGB8888'], [23, 'RGB565'], [24, 'XRGB1555'], [25, 'ARGB1555'], [26, 'ARGB4444']]);
function native(bytes: Uint8Array, version: number): NativeTexture {
  const outer = new BinaryReader(bytes), structure = readChunk(outer);
  requireAsset(structure.type === 1, 'Native texture has no structure.');
  const r = new BinaryReader(structure.bytes), platform = r.u32();
  requireAsset(platform === 9, `Texture platform ${platform} is not supported; select a classic PC Direct3D 9 dictionary.`);
  const sampling = r.u32(), name = r.name(32), mask = r.name(32), rasterFormat = r.u32(), d3dFormat = r.u32();
  const width = r.u16(), height = r.u16(), depth = r.u8(), levels = r.u8(); r.u8(); const flags = r.u8();
  requireAsset(width > 0 && height > 0 && width <= 4096 && height <= 4096, 'Texture dimensions exceed the 4096 × 4096 limit.');
  requireAsset(levels > 0 && levels <= 1 + Math.floor(Math.log2(Math.max(width, height))), 'Invalid mip level count.');
  requireAsset(!(flags & 2), 'Cube textures are not supported yet.');
  requireAsset(!(rasterFormat & 0x4000), '4-bit palette textures are not supported yet.');
  const palette = rasterFormat & 0x2000 ? r.take(1024) : undefined;
  const format = palette ? 'PAL8' : formats.get(d3dFormat);
  requireAsset(format, `Unsupported Direct3D texture format: ${d3dFormat}.`);
  requireAsset(!palette || depth === 8, 'Invalid palette texture depth.');
  const mips: TextureMip[] = [];
  for (let level = 0; level < levels; level++) {
    const w = Math.max(1, width >> level), h = Math.max(1, height >> level), data = r.take(r.u32());
    const row = w * (format === 'PAL8' ? 1 : format.endsWith('8888') ? 4 : format === 'RGB888' ? 3 : 2);
    const expected = format.startsWith('DXT') ? Math.ceil(w / 4) * Math.ceil(h / 4) * (format === 'DXT1' ? 8 : 16) : row * h;
    requireAsset(data.length === 0 && level > 0 && format.startsWith('DXT') && (w < 4 || h < 4) || data.length === expected || !format.startsWith('DXT') && data.length === Math.ceil(row / 4) * 4 * h, `Incorrect texture mip size: ${name}, ${format}, level ${level}, ${w}×${h}, ${data.length} bytes (expected ${expected}).`);
    mips.push({ width: w, height: h, bytes: data });
  }
  requireAsset(r.position === r.bytes.length, 'Unexpected native texture payload.');
  return { name, mask, version, width, height, depth, filter: sampling & 255, addressU: (sampling >>> 8) & 15, addressV: (sampling >>> 12) & 15,
    hasAlpha: !!(flags & 1), rasterFormat, d3dFormat, palette, format, mips };
}
export function readTxd(bytes: Uint8Array): NativeTexture[] {
  requireAsset(bytes.length <= 64 * 1024 * 1024, 'This texture dictionary exceeds the 64 MiB import limit.');
  const root = readChunk(new BinaryReader(bytes)); requireAsset(root.type === 0x16, 'This is not a RenderWare texture dictionary.');
  const r = new BinaryReader(root.bytes), structure = readChunk(r); requireAsset(structure.type === 1, 'Missing texture dictionary structure.');
  const header = new BinaryReader(structure.bytes), count = header.u16(); header.u16();
  requireAsset(count <= 4096, 'This dictionary exceeds the 4096 texture limit.');
  const textures: NativeTexture[] = [];
  while (r.position < r.bytes.length) {
    const chunk = readChunk(r);
    if (chunk.type === 0x15) { requireAsset(textures.length < count, 'Texture count does not match the dictionary.'); textures.push(native(chunk.bytes, chunk.version)); }
  }
  requireAsset(textures.length === count, 'Texture count does not match the dictionary.');
  return textures;
}
export function decodeTexture(texture: NativeTexture, level = 0):Uint8ClampedArray {
  requireAsset(Number.isInteger(level) && level >= 0 && level < texture.mips.length, 'Invalid mip selection.');
  const { width, height, bytes } = texture.mips[level], format = texture.format;
  // Some public native dictionaries store zero-byte sub-block DXT tails.
  // Reconstruct only these absent levels; all supplied texels remain untouched.
  if(bytes.length===0){
    requireAsset(level>0&&format.startsWith('DXT')&&(width<4||height<4),'Invalid empty texture mip.');
    const previous=texture.mips[level-1],pixels=decodeTexture(texture,level-1),result=new Uint8ClampedArray(width*height*4);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(let c=0;c<4;c++){
      let sum=0,count=0;
      for(let dy=0;dy<Math.min(2,previous.height);dy++)for(let dx=0;dx<Math.min(2,previous.width);dx++){sum+=pixels[((y*2+dy)*previous.width+x*2+dx)*4+c];count++;}
      result[(y*width+x)*4+c]=Math.round(sum/count);
    }
    return result;
  }
  if (format.startsWith('DXT')) return decodeDxt(bytes, width, height, format as DxtFormat);
  const rgba = new Uint8ClampedArray(width * height * 4), stride = bytes.length / height;
  const size = format === 'PAL8' ? 1 : format.endsWith('8888') ? 4 : format === 'RGB888' ? 3 : 2;
  const scale = (value: number, bits: number) => Math.round(value * 255 / ((1 << bits) - 1));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const at = y * stride + x * size, dest = (y * width + x) * 4;
    let r: number, g: number, b: number, a = 255;
    if (texture.palette) {
      const p = bytes[at] * 4; [r, g, b, a] = texture.palette.subarray(p, p + 4);
    } else if (size >= 3) {
      [b, g, r] = bytes.subarray(at, at + 3); if (format === 'ARGB8888') a = bytes[at + 3];
    } else {
      const v = bytes[at] | bytes[at + 1] << 8;
      if (format === 'RGB565') { r = scale(v >>> 11, 5); g = scale((v >>> 5) & 63, 6); b = scale(v & 31, 5); }
      else if (format === 'ARGB4444') { r = ((v >>> 8) & 15) * 17; g = ((v >>> 4) & 15) * 17; b = (v & 15) * 17; a = (v >>> 12) * 17; }
      else { r = scale((v >>> 10) & 31, 5); g = scale((v >>> 5) & 31, 5); b = scale(v & 31, 5); if (format === 'ARGB1555') a = v & 0x8000 ? 255 : 0; }
    }
    rgba.set([r, g, b, a], dest);
  }
  return rgba;
}
