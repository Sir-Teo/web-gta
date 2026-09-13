import { requireAsset } from './binary';
export type DxtFormat = 'DXT1' | 'DXT3' | 'DXT5';
function rgb565(value: number) {
  const r = value >>> 11, g = (value >>> 5) & 63, b = value & 31;
  return [(r << 3) | (r >>> 2), (g << 2) | (g >>> 4), (b << 3) | (b >>> 2), 255];
}
export function decodeDxt(bytes: Uint8Array, width: number, height: number, format: DxtFormat) {
  requireAsset(Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width * height <= 4096 * 4096, 'Invalid texture dimensions.');
  const blockSize = format === 'DXT1' ? 8 : 16, blocksX = Math.ceil(width / 4), blocksY = Math.ceil(height / 4);
  requireAsset(bytes.length === blocksX * blocksY * blockSize, 'Incorrect compressed mip size.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), rgba = new Uint8ClampedArray(width * height * 4);
  for (let by = 0; by < blocksY; by++) for (let bx = 0; bx < blocksX; bx++) {
    const offset = (by * blocksX + bx) * blockSize, color = offset + (format === 'DXT1' ? 0 : 8);
    const c0 = view.getUint16(color, true), c1 = view.getUint16(color + 2, true), colors = [rgb565(c0), rgb565(c1)];
    const fourColors = format !== 'DXT1' || c0 > c1;
    colors.push(colors[0].map((v, c) => c === 3 ? 255 : Math.floor(fourColors ? (2 * v + colors[1][c]) / 3 : (v + colors[1][c]) / 2)));
    colors.push(fourColors ? colors[0].map((v, c) => c === 3 ? 255 : Math.floor((v + 2 * colors[1][c]) / 3)) : [0, 0, 0, 0]);
    const indices = view.getUint32(color + 4, true), alphas = [bytes[offset], bytes[offset + 1]];
    if (format === 'DXT5') {
      const interpolated = alphas[0] > alphas[1] ? 6 : 4;
      for (let i = 1; i <= interpolated; i++) alphas.push(Math.floor(((interpolated + 1 - i) * alphas[0] + i * alphas[1]) / (interpolated + 1)));
      if (interpolated === 4) alphas.push(0, 255);
    }
    for (let pixel = 0; pixel < 16; pixel++) {
      const x = bx * 4 + pixel % 4, y = by * 4 + Math.floor(pixel / 4);
      if (x >= width || y >= height) continue;
      const dest = (y * width + x) * 4, value = colors[(indices >>> (pixel * 2)) & 3];
      rgba.set(value, dest);
      if (format === 'DXT3') rgba[dest + 3] = ((bytes[offset + (pixel >>> 1)] >>> ((pixel & 1) * 4)) & 15) * 17;
      if (format === 'DXT5') {
        const bit = pixel * 3, byte = offset + 2 + (bit >>> 3), shift = bit & 7;
        const index = ((bytes[byte] | (bytes[byte + 1] ?? 0) << 8) >>> shift) & 7;
        rgba[dest + 3] = alphas[index];
      }
    }
  }
  return rgba;
}
