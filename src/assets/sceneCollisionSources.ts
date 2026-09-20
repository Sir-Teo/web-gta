import { requireAsset } from './binary';
import { readCollisionFile, type ColModel } from './col';
import type { ImgEntry } from './img';

export interface SceneCollisionSources {
  file: File;
  collisionFile?: File;
  collisionEntry?: ImgEntry;
  additionalCollisionFiles?: File[];
  allArchiveCollisions?: boolean;
}
/** Decoded collections by archive and selection: a streamed window asks for the same district collections as the
 * last one, and decoding them again cost 250 to 350 ms a window. Six selections are kept per archive. */
const memo = new WeakMap<File, Map<string, Promise<CollisionSourcesResult>>>();
type CollisionSourcesResult = { models: ColModel[] | undefined; origins: Map<string, string>; sourceNames: string[] };
/** Resolve collections once per scene; never silently select one of two same-name shapes. The result is shared by
 * later scenes with the same selection, so callers must not modify it. */
export function readSceneCollisionSources(request: SceneCollisionSources, entries: ImgEntry[]): Promise<CollisionSourcesResult> {
  const key = JSON.stringify([request.collisionFile && [request.collisionFile.name, request.collisionFile.size], request.collisionEntry?.name, !!request.allArchiveCollisions, (request.additionalCollisionFiles ?? []).map(f => [f.name, f.size])]);
  let byKey = memo.get(request.file); if (!byKey) { byKey = new Map(); memo.set(request.file, byKey); }
  const hit = byKey.get(key); if (hit) { byKey.delete(key); byKey.set(key, hit); return hit; }
  const pending = readSceneCollisionSourcesUncached(request, entries);
  byKey.set(key, pending); pending.catch(() => byKey!.delete(key));
  while (byKey.size > 6) byKey.delete(byKey.keys().next().value!);
  return pending;
}
async function readSceneCollisionSourcesUncached(request: SceneCollisionSources, entries: ImgEntry[]): Promise<CollisionSourcesResult> {
  const sources: { name: string; size: number; file?: File; entry?: ImgEntry }[] = [];
  if (request.collisionFile) sources.push({ name: request.collisionFile.name, size: request.collisionFile.size, file: request.collisionFile });
  else if (request.collisionEntry && !request.allArchiveCollisions) sources.push({ name: `${request.file.name} / ${request.collisionEntry.name}`, size: request.collisionEntry.length, entry: request.collisionEntry });
  if (request.allArchiveCollisions) for (const entry of entries.filter(e => /\.col$/i.test(e.name))) sources.push({ name: `${request.file.name} / ${entry.name}`, size: entry.length, entry });
  for (const file of request.additionalCollisionFiles ?? []) sources.push({ name: file.name, size: file.size, file });
  requireAsset(sources.length <= 256, 'Scene exceeds the 256 collision collection limit.');
  requireAsset(sources.reduce((sum, source) => sum + source.size, 0) <= 128 * 1024 * 1024, 'Scene collision sources exceed 128 MiB.');
  const models: ColModel[] = [], origins = new Map<string, string>();
  for (const source of sources) {
    let collection: ColModel[];
    try { collection = (await readCollisionFile(source.file, request.file, source.entry))!; }
    catch (error) { throw new Error(`${source.name}: ${error instanceof Error ? error.message : 'Collision read failed.'}`); }
    for (const model of collection) {
      const name = model.name.toLowerCase();
      requireAsset(!origins.has(name), `Ambiguous collision model ${model.name}: ${origins.get(name)} and ${source.name}. Select non-overlapping collections.`);
      origins.set(name, source.name); models.push(model);
      requireAsset(models.length <= 20000, 'Scene exceeds the 20,000 collision model limit.');
    }
  }
  return { models: sources.length ? models : undefined, origins, sourceNames: sources.map(source => source.name) };
}
