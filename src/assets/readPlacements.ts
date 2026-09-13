import { requireAsset } from './binary';
import { readIpl } from './ipl';
import { readImgEntry, type ImgEntry } from './img';
export interface PlacementSource { file: File; placementFile?: File; placementEntry?: ImgEntry; }
export async function readPlacements(source: PlacementSource) {
  const external = source.placementFile;
  requireAsset(external || source.placementEntry, 'Select an IPL file or archived placement entry.');
  if (external) requireAsset(external.size <= 64 * 1024 * 1024, 'IPL exceeds the 64 MiB source limit.');
  const bytes = external ? new Uint8Array(await external.arrayBuffer()) : await readImgEntry(source.file, source.placementEntry!);
  return { ipl: readIpl(bytes), name: external ? external.name : `${source.file.name} / ${source.placementEntry!.name}` };
}
