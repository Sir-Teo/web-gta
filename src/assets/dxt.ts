import { requireAsset } from './binary';
export type DxtFormat = 'DXT1' | 'DXT3' | 'DXT5';
/** A 5- or 6-bit channel widened to 8 bits, its top bits repeated below, as D3D9 reads a 565 colour. */
const expand5 = (v: number) => (v << 3) | (v >>> 2), expand6 = (v: number) => (v << 2) | (v >>> 4);
function blocks(bytes: Uint8Array, width: number, height: number, format: DxtFormat) {
  requireAsset(Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width * height <= 4096 * 4096, 'Invalid texture dimensions.');
  const blockSize = format === 'DXT1' ? 8 : 16, blocksX = Math.ceil(width / 4), blocksY = Math.ceil(height / 4);
  requireAsset(bytes.length === blocksX * blocksY * blockSize, 'Incorrect compressed mip size.');
  return { blockSize, blocksX, blocksY };
}
/** A block's four colours as 8-bit RGBA into `palette` (16 bytes): the two endpoints and the two between them, or,
 * for a DXT1 block whose first endpoint is not the greater, their middle and transparent black. Blocks run through
 * without an allocation each: a phone without S3TC decodes every texture the world streams in. */
function blockPalette(bytes: Uint8Array, color: number, fourColors: boolean | undefined, palette: Uint8Array) {
  const c0 = bytes[color] | bytes[color + 1] << 8, c1 = bytes[color + 2] | bytes[color + 3] << 8;
  palette[0] = expand5(c0 >>> 11); palette[1] = expand6((c0 >>> 5) & 63); palette[2] = expand5(c0 & 31); palette[3] = 255;
  palette[4] = expand5(c1 >>> 11); palette[5] = expand6((c1 >>> 5) & 63); palette[6] = expand5(c1 & 31); palette[7] = 255;
  const four = fourColors ?? c0 > c1;
  for (let c = 0; c < 3; c++) {
    const a = palette[c], b = palette[4 + c];
    if (four) { palette[8 + c] = Math.floor((2 * a + b) / 3); palette[12 + c] = Math.floor((a + 2 * b) / 3); }
    else { palette[8 + c] = Math.floor((a + b) / 2); palette[12 + c] = 0; }
  }
  palette[11] = 255; palette[15] = four ? 255 : 0;
  return (bytes[color + 4] | bytes[color + 5] << 8 | bytes[color + 6] << 16 | bytes[color + 7] << 24) >>> 0;
}
export function decodeDxt(bytes: Uint8Array, width: number, height: number, format: DxtFormat) {
  const { blockSize, blocksX, blocksY } = blocks(bytes, width, height, format);
  const rgba = new Uint8ClampedArray(width * height * 4), palette = new Uint8Array(16), alphas = new Uint8Array(8);
  for (let by = 0; by < blocksY; by++) for (let bx = 0; bx < blocksX; bx++) {
    const offset = (by * blocksX + bx) * blockSize;
    const indices = blockPalette(bytes, offset + (format === 'DXT1' ? 0 : 8), format === 'DXT1' ? undefined : true, palette);
    if (format === 'DXT5') {
      const a0 = bytes[offset], a1 = bytes[offset + 1], interpolated = a0 > a1 ? 6 : 4;
      alphas[0] = a0; alphas[1] = a1;
      for (let i = 1; i <= interpolated; i++) alphas[1 + i] = Math.floor(((interpolated + 1 - i) * a0 + i * a1) / (interpolated + 1));
      if (interpolated === 4) { alphas[6] = 0; alphas[7] = 255; }
    }
    for (let pixel = 0; pixel < 16; pixel++) {
      const x = bx * 4 + (pixel & 3), y = by * 4 + (pixel >>> 2);
      if (x >= width || y >= height) continue;
      const dest = (y * width + x) * 4, p = ((indices >>> (pixel * 2)) & 3) * 4;
      rgba[dest] = palette[p]; rgba[dest + 1] = palette[p + 1]; rgba[dest + 2] = palette[p + 2]; rgba[dest + 3] = palette[p + 3];
      if (format === 'DXT3') rgba[dest + 3] = ((bytes[offset + (pixel >>> 1)] >>> ((pixel & 1) * 4)) & 15) * 17;
      else if (format === 'DXT5') {
        const bit = pixel * 3, byte = offset + 2 + (bit >>> 3), shift = bit & 7;
        rgba[dest + 3] = alphas[((bytes[byte] | (bytes[byte + 1] ?? 0) << 8) >>> shift) & 7];
      }
    }
  }
  return rgba;
}
/** An 8-bit channel to 5 bits, rounded as a GPU narrows RGBA8 to RGB5_A1. */
const narrow5 = (v: number) => ((v * 31 + 127) / 255) | 0;
/** A DXT1 raster as 16-bit RGBA 5551 pixels, for a GPU that cannot sample DXT (most phones'): half the memory of the
 * RGBA a decode otherwise makes, with DXT1's own one-bit alpha and its colours, 565 at the ends, at five bits a
 * channel. The pixel is what decodeDxt's would be, narrowed. */
export function decodeDxt1To5551(bytes: Uint8Array, width: number, height: number) {
  const { blocksX, blocksY } = blocks(bytes, width, height, 'DXT1');
  const out = new Uint16Array(width * height), palette = new Uint8Array(16), packed = new Uint16Array(4);
  for (let by = 0; by < blocksY; by++) for (let bx = 0; bx < blocksX; bx++) {
    const indices = blockPalette(bytes, (by * blocksX + bx) * 8, undefined, palette);
    for (let i = 0; i < 4; i++) { const p = i * 4; packed[i] = palette[p + 3] ? narrow5(palette[p]) << 11 | narrow5(palette[p + 1]) << 6 | narrow5(palette[p + 2]) << 1 | 1 : 0; }
    for (let pixel = 0; pixel < 16; pixel++) {
      const x = bx * 4 + (pixel & 3), y = by * 4 + (pixel >>> 2);
      if (x < width && y < height) out[y * width + x] = packed[(indices >>> (pixel * 2)) & 3];
    }
  }
  return out;
}
