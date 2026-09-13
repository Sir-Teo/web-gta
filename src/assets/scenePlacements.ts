import { requireAsset } from './binary';
import type { ImgEntry } from './img';
import { readPlacements, type PlacementSource } from './readPlacements';
export type PlacementNamespace = 'primary' | 'static' | `stream:${number}`;
export const validPlacementNamespace = (value: string) => value === 'primary' || value === 'static' || /^stream:[1-9][0-9]{0,2}$/.test(value) && Number(value.slice(7)) <= 255;
export interface ScenePlacementSources extends PlacementSource { staticPlacementFile?: File; additionalPlacementFiles?: File[]; additionalPlacementEntries?: ImgEntry[]; }
export interface PlacementRef { namespace: PlacementNamespace; index: number; format: 'text' | 'binary'; sourceName: string; lodTarget?: { namespace: PlacementNamespace; index: number }; }
/** Explicit namespaces prevent streamed LOD indices from resolving against the wrong file. */
export async function readScenePlacements(request: ScenePlacementSources) {
  const extras: PlacementSource[] = [
    ...(request.additionalPlacementEntries ?? []).map(placementEntry => ({ file: request.file, placementEntry })),
    ...(request.additionalPlacementFiles ?? []).map(placementFile => ({ file: request.file, placementFile })),
  ];
  requireAsset(extras.length <= 255, 'Scene exceeds the 255 additional streamed IPL limit.');
  const selected = [request, ...extras];
  requireAsset(selected.reduce((sum, source) => sum + (source.placementFile?.size ?? source.placementEntry?.length ?? 0), request.staticPlacementFile?.size ?? 0) <= 128 * 1024 * 1024, 'Scene IPL sources exceed 128 MiB.');
  const names = new Set<string>();
  for (const source of selected) {
    const name = (source.placementFile?.name ?? source.placementEntry?.name ?? '').toLowerCase();
    requireAsset(!names.has(name), `Duplicate streamed IPL source: ${name}.`); names.add(name);
  }
  const primary = await readPlacements(request);
  requireAsset(!extras.length || primary.ipl.format === 'binary', 'Additional streamed IPLs require a binary primary IPL.');
  requireAsset(!request.staticPlacementFile || primary.ipl.format === 'binary', 'A static LOD source requires a binary primary IPL.');
  const base = request.staticPlacementFile ? await readPlacements({ file: request.file, placementFile: request.staticPlacementFile }) : undefined;
  requireAsset(!base || base.ipl.format === 'text', 'The static LOD source must be a text IPL.');
  const sources: { data: Awaited<ReturnType<typeof readPlacements>>; namespace: PlacementNamespace }[] = [...(base ? [{ data: base, namespace: 'static' as const }] : []), { data: primary, namespace: 'primary' }];
  let total = sources.reduce((sum, source) => sum + source.data.ipl.instances.length, 0);
  for (const [index, source] of extras.entries()) {
    const data = await readPlacements(source);
    requireAsset(data.ipl.format === 'binary', `${data.name}: additional streamed IPL must be binary.`);
    total += data.ipl.instances.length;
    requireAsset(total <= 200000, 'Scene IPL sources exceed 200,000 instances.');
    sources.push({ data, namespace: `stream:${index + 1}` });
  }
  requireAsset(total <= 200000, 'Scene IPL sources exceed 200,000 instances.');
  const rows = sources.flatMap(({ data, namespace }) => data.ipl.instances.map((placement, index) => {
    const ref: PlacementRef = { namespace, index, format: data.ipl.format, sourceName: data.name };
    if (placement.lodIndex >= 0) ref.lodTarget = { namespace: data.ipl.format === 'binary' ? 'static' : namespace, index: placement.lodIndex };
    return { placement, ref };
  }));
  const key = (ref: { namespace: string; index: number }) => `${ref.namespace}:${ref.index}`;
  const byKey = new Map(rows.map(row => [key(row.ref), row]));
  // Follow each chain once, without recursion; even a long malformed IPL cannot exhaust the JS stack.
  const complete = new Set<string>();
  for (const row of rows) {
    const path = new Set<string>(); let current: typeof row | undefined = row;
    while (current && !complete.has(key(current.ref))) {
      const id = key(current.ref); requireAsset(!path.has(id), `Cyclic IPL LOD link at ${id}.`); path.add(id);
      current = current.ref.lodTarget ? byKey.get(key(current.ref.lodTarget)) : undefined;
    }
    path.forEach(id => complete.add(id));
  }
  return { rows, byKey, key, hasStatic: !!base, placementSource: sources.filter(source => source.namespace !== 'static').map(source => source.data.name).join('; '), staticPlacementSource: base?.name, warnings: sources.flatMap(source => source.data.ipl.warnings.map(warning => `${source.data.name}: ${warning}`)) };
}
