import { BinaryReader, requireAsset } from './binary';
export interface ImgEntry { name: string; offset: number; length: number; archivedSectors: number }
const SECTOR = 2048;
export async function readImgIndex(file: Blob): Promise<ImgEntry[]> {
  const header = new BinaryReader(new Uint8Array(await file.slice(0, 8).arrayBuffer()));
  requireAsset(header.name(4) === 'VER2', 'Only classic San Andreas VER2 IMG archives are supported.');
  const count = header.u32(), directoryEnd = 8 + count * 32;
  requireAsset(count <= 200000 && directoryEnd <= file.size, 'Invalid IMG directory size.');
  const reader = new BinaryReader(new Uint8Array(await file.slice(8, directoryEnd).arrayBuffer()));
  const entries: ImgEntry[] = [], names = new Set<string>();
  for (let i = 0; i < count; i++) {
    const offset = reader.u32() * SECTOR, sectors = reader.u16(), archivedSectors = reader.u16(), name = reader.name(24);
    const length = (archivedSectors || sectors) * SECTOR;
    requireAsset(name.length > 0 && !/[\x00-\x1f\\/]/.test(name) && name !== '.' && name !== '..', 'Invalid IMG entry name.');
    requireAsset(!names.has(name.toLowerCase()), `Duplicate IMG entry: ${name}`); names.add(name.toLowerCase());
    requireAsset(length > 0 && offset >= Math.ceil(directoryEnd / SECTOR) * SECTOR && offset + length <= file.size, `IMG entry is outside the archive: ${name}`);
    entries.push({ name, offset, length, archivedSectors });
  }
  const byOffset = [...entries].sort((a, b) => a.offset - b.offset);
  for (let i = 1; i < byOffset.length; i++) requireAsset(byOffset[i].offset >= byOffset[i - 1].offset + byOffset[i - 1].length, 'Overlapping IMG entries.');
  return entries;
}
/** An archive that hands out an entry's bytes directly (the published world, staticWorldArchive.ts). Going through
 * `slice().arrayBuffer()` there constructs Blob objects per read, which Chrome registers with its blob store. */
export interface RangeReadable { readRange(from: number, to: number): Promise<Uint8Array> }
export async function readImgEntry(file: Blob, entry: ImgEntry) {
  requireAsset(entry.archivedSectors === 0, 'Packed IMG entries are not supported yet.');
  requireAsset(Number.isSafeInteger(entry.offset) && Number.isSafeInteger(entry.length) && entry.offset >= 0 && entry.length > 0 && entry.offset + entry.length <= file.size, 'IMG selection is outside the archive.');
  requireAsset(entry.length <= 64 * 1024 * 1024, 'This archive entry exceeds the 64 MiB import limit.');
  const direct = (file as Blob & Partial<RangeReadable>).readRange;
  if (typeof direct === 'function') {
    const bytes = await direct.call(file, entry.offset, entry.offset + entry.length);
    // Callers own what they get back: a view into shared storage is copied out.
    return (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes : bytes.slice()) as Uint8Array<ArrayBuffer>;
  }
  return new Uint8Array(await file.slice(entry.offset, entry.offset + entry.length).arrayBuffer());
}
