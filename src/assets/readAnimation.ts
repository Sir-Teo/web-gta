import { requireAsset } from './binary';
import { readIfp } from './ifp';
import { readImgEntry, type ImgEntry } from './img';
export async function readAnimation(source: { file: File; entry?: ImgEntry }) {
  requireAsset(source.entry || source.file.size <= 64 * 1024 * 1024, 'IFP exceeds the 64 MiB source limit.');
  const bytes = source.entry ? await readImgEntry(source.file, source.entry) : new Uint8Array(await source.file.arrayBuffer());
  return { animation: readIfp(bytes), name: source.entry ? `${source.file.name} / ${source.entry.name}` : source.file.name };
}
