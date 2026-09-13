import { requireAsset } from './binary';
import { readPlacements, type PlacementSource } from './readPlacements';
export interface PlacementRef { namespace: 'primary' | 'static'; index: number; format: 'text' | 'binary'; sourceName: string; lodTarget?: { namespace: 'primary' | 'static'; index: number }; }
/** Explicit namespaces prevent streamed LOD indices from resolving against the wrong file. */
export async function readScenePlacements(request: PlacementSource & { staticPlacementFile?: File }) {
  const primary = await readPlacements(request);
  requireAsset(!request.staticPlacementFile || primary.ipl.format === 'binary', 'A static LOD source requires a binary primary IPL.');
  const base = request.staticPlacementFile ? await readPlacements({ file: request.file, placementFile: request.staticPlacementFile }) : undefined;
  requireAsset(!base || base.ipl.format === 'text', 'The static LOD source must be a text IPL.');
  const rows = ([...(base ? [{ data: base, namespace: 'static' as const }] : []), { data: primary, namespace: 'primary' as const }]).flatMap(({ data, namespace }) => data.ipl.instances.map((placement, index) => {
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
  return { rows, byKey, key, hasStatic: !!base, placementSource: primary.name, staticPlacementSource: base?.name, warnings: [...primary.ipl.warnings, ...(base?.ipl.warnings ?? [])] };
}
