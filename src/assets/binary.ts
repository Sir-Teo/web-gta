export class AssetFormatError extends Error {}
export function requireAsset(condition: unknown, message: string): asserts condition {
  if (!condition) throw new AssetFormatError(message);
}
export class BinaryReader {
  readonly view: DataView;
  position = 0;
  constructor(readonly bytes: Uint8Array) { this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
  take(length: number) {
    requireAsset(Number.isSafeInteger(length) && length >= 0 && this.position + length <= this.bytes.length, 'Truncated asset data.');
    const result = this.bytes.subarray(this.position, this.position + length); this.position += length; return result;
  }
  u8() { return this.take(1)[0]; }
  u16() { const start = this.position; this.take(2); return this.view.getUint16(start, true); }
  u32() { const start = this.position; this.take(4); return this.view.getUint32(start, true); }
  name(length: number) {
    const bytes = this.take(length), end = bytes.indexOf(0);
    return new TextDecoder('windows-1252').decode(bytes.subarray(0, end < 0 ? length : end));
  }
}
export interface Chunk { type: number; version: number; bytes: Uint8Array }
export function readChunk(reader: BinaryReader): Chunk {
  const type = reader.u32(), size = reader.u32(), version = reader.u32();
  return { type, version, bytes: reader.take(size) };
}
