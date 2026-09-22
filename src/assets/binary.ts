export class AssetFormatError extends Error {}
export function requireAsset(condition: unknown, message: string): asserts condition {
  if (!condition) throw new AssetFormatError(message);
}
/** Native names are Windows-1252; a non-streaming decode keeps no state between calls, so one decoder serves all. */
const latin = new TextDecoder('windows-1252');
export class BinaryReader {
  readonly view: DataView;
  position = 0;
  /** Repair pass for corrupt depot floats: zero non-finite values and count them. */
  sanitizeNonFinite = false;
  repairs = 0;
  constructor(readonly bytes: Uint8Array) { this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
  take(length: number) {
    requireAsset(Number.isSafeInteger(length) && length >= 0 && this.position + length <= this.bytes.length, 'Truncated asset data.');
    const result = this.bytes.subarray(this.position, this.position + length); this.position += length; return result;
  }
  // Scalar reads advance past a bounds check instead of slicing: every DFF, TXD, COL and IFP value comes through
  // here, and a subarray per value was most of what an animation package cost to parse.
  private advance(length: number) {
    const start = this.position;
    requireAsset(start + length <= this.bytes.length, 'Truncated asset data.');
    this.position = start + length; return start;
  }
  u8() { return this.bytes[this.advance(1)]; }
  u16() { return this.view.getUint16(this.advance(2), true); }
  u32() { return this.view.getUint32(this.advance(4), true); }
  i32() { return this.u32() | 0; }
  f32() {
    const value = this.view.getFloat32(this.advance(4), true);
    if (!Number.isFinite(value)) {
      // Corrupt-depot repair pass: NaN/Infinity coordinates are zeroed and counted instead of aborting the model.
      if (!this.sanitizeNonFinite) { requireAsset(false, 'Non-finite model coordinate.'); }
      this.repairs++;
      return 0;
    }
    return value;
  }
  floats(count: number) {
    requireAsset(Number.isSafeInteger(count) && count >= 0 && count * 4 <= this.bytes.length - this.position, 'Truncated model attribute.');
    const values = new Float32Array(count); for (let i = 0; i < count; i++) values[i] = this.f32(); return values;
  }
  name(length: number) {
    const bytes = this.take(length), end = bytes.indexOf(0);
    return latin.decode(bytes.subarray(0, end < 0 ? length : end));
  }
}
export interface Chunk { type: number; version: number; bytes: Uint8Array }
export function readChunk(reader: BinaryReader): Chunk {
  const type = reader.u32(), size = reader.u32(), version = reader.u32();
  return { type, version, bytes: reader.take(size) };
}
