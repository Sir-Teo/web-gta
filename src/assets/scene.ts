import { selectSceneRegion, type SceneRegion } from './sceneRegion';
import { readSceneCollisionSources, type SceneCollisionSources } from './sceneCollisionSources';
import { readScenePlacements, type PlacementRef, type ScenePlacementSources } from './scenePlacements';
import { requireAsset } from './binary';
import { type IplInstance } from './ipl';
import { readImgIndex, type ImgEntry } from './img';
import { sceneVisibilityBounds, type SceneVisibilityBounds } from './sceneBounds';
import { planSceneCollision } from './sceneCollision';
import { timeModelCounterparts } from './timeModels';
import type { IdeAssociation } from './ide';
import { readModel, ModelReadCache } from './readModel';
export interface SceneRequest extends ScenePlacementSources, SceneCollisionSources { staticPlacementFile?: File; textureFiles?: File[]; region?: SceneRegion; collisionFile?: File; collisionEntry?: ImgEntry; associations: IdeAssociation[]; parents: [string, string][]; interior: number; }
export type ScenePart = Awaited<ReturnType<typeof readModel>> & { name: string; placements: IplInstance[]; sourceIndices?: number[]; sourceRefs?: PlacementRef[]; placementFormat?: 'text' | 'binary'; definition?: IdeAssociation; timeCounterpart?: string; visibilityBounds?: SceneVisibilityBounds };
export async function readScene(request: SceneRequest) {
  requireAsset(Number.isInteger(request.interior) && request.interior >= 0 && request.interior <= 255, 'Interior must be an integer from 0 to 255.');
  const placementsData = await readScenePlacements(request), entries = await readImgIndex(request.file);
  const { placementSource, staticPlacementSource, rows, byKey, key } = placementsData;
  const byName = new Map(request.associations.map(a => [a.model.toLowerCase(), a])), byId = new Map<number, IdeAssociation>();
  for (const a of request.associations) {
    requireAsset(!byId.has(a.id) || byId.get(a.id)!.model.toLowerCase() === a.model.toLowerCase(), `Ambiguous IDE model ID ${a.id}.`); byId.set(a.id, a);
  }
  const counterparts = timeModelCounterparts(request.associations);
  const groups = new Map<string, IplInstance[]>(), notices = [...placementsData.warnings]; let missingIds = 0;
  const refs = new Map(rows.map(row => [row.placement, row.ref]));
  const instances = selectSceneRegion(rows, request.interior, request.region);
  requireAsset(instances.length > 0 && instances.length <= 4096, 'Scene requires 1–4,096 placements in the selected interior.');
  for (const instance of instances) {
    const name = (instance.modelName ?? byId.get(instance.modelId)?.model)?.toLowerCase();
    if (!name) { missingIds++; continue; }
    if (!groups.has(name)) groups.set(name, []); groups.get(name)!.push(instance);
  }
  if (request.region) notices.push(`Scene area uses placement origins within ${request.region.radius} units of native XY ${request.region.x}, ${request.region.y}, plus linked LOD ancestors. Objects with distant origins may cross the boundary.`);
  if (missingIds) notices.push(`${missingIds} placements lack an IDE model definition.`);
  requireAsset(groups.size <= 256, 'Scene exceeds the 256 model limit.');
  const collisionSources = await readSceneCollisionSources(request, entries);
  const collisionModels = collisionSources.models;
  const cache = new ModelReadCache(request.file, entries, request.textureFiles), countedPixels = new Set<ArrayBufferLike>();
  if (cache.externalDictionaries.size) notices.push(`External scene dictionaries override same-name archived dictionaries: ${[...cache.externalDictionaries.keys()].join(', ')}`);
  const scene: ScenePart[] = []; let memory = 0, triangles = 0, nodes = 0, missingModels = 0;
  for (const [name, placements] of groups) {
    const entry = entries.find(e => e.name.toLowerCase() === `${name}.dff`);
    if (!entry) { missingModels += placements.length; notices.push(`Missing model: ${name}.dff (${placements.length} placements).`); continue; }
    const dictionary = byName.get(name)?.dictionary ?? name;
    const textureEntry = entries.find(e => e.name.toLowerCase() === `${dictionary.toLowerCase()}.txd`);
    const textureFile = cache.externalDictionaries.get(`${dictionary.toLowerCase()}.txd`);
    const part = await readModel({ file: request.file, entry, textureFile, textureEntry, collisionModels, parents: request.parents }, cache);
    if (!textureEntry && !textureFile) part.notices.push(`Missing dictionary: ${dictionary}.txd.`);
    const bound = new Set(part.textures.map(t => t.name.toLowerCase()));
    const missing = [...new Set(part.model.geometries.flatMap(g => g.materials.map(m => m.texture).filter(n => n && !bound.has(n.toLowerCase()))))];
    if (missing.length) part.notices.push(`Unbound textures: ${missing.join(', ')}`);
    for (const geometry of part.model.geometries) for (const a of [geometry.positions, geometry.normals, geometry.colors, geometry.nightColors, geometry.indices, geometry.materialIds, geometry.skin?.indices, geometry.skin?.weights, geometry.skin?.inverseMatrices, geometry.skin?.usedBones, ...geometry.uvs]) memory += a?.byteLength ?? 0;
    for (const texture of part.textures) for (const mip of texture.mips) if (!countedPixels.has(mip.data.buffer)) { memory += mip.data.byteLength; countedPixels.add(mip.data.buffer); }
    triangles += placements.length * part.model.atomics.filter(a => a.flags & 4).reduce((n, a) => n + part.model.geometries[a.geometry].indices.length / 3, 0);
    nodes += placements.length * (part.model.frames.length + part.model.atomics.length);
    requireAsset(memory <= 128 * 1024 * 1024 && triangles <= 2000000 && nodes <= 100000, 'Scene exceeds its decoded memory, triangle or hierarchy limit.');
    scene.push({ ...part, collisionSource: collisionSources.origins.get(name), name, placements, sourceIndices: placements.map(p => refs.get(p)!.index), sourceRefs: placements.map(p => refs.get(p)!), placementFormat: placementsData.hasStatic ? undefined : rows[0]?.ref.format, definition: byName.get(name), timeCounterpart: counterparts.get(name) });
  }
  requireAsset(scene.length > 0, 'No scene models could be resolved from the selected archive and definitions.');
  const loaded = new Set(scene.flatMap(part => part.sourceRefs!.map(key)));
  const lodLinks = instances.filter(p => p.lodIndex >= 0).map(p => {
    const ref = refs.get(p)!, targetRef = ref.lodTarget!, target = byKey.get(key(targetRef))?.placement;
    const status = targetRef.namespace === 'static' && !placementsData.hasStatic ? 'external-static-array' : !target ? 'missing-placement' : target.interior !== request.interior ? 'other-interior' : !loaded.has(key(targetRef)) ? 'missing-model' : ref.namespace !== targetRef.namespace ? 'resolved-static' : 'local';
    return { sourceIndex: ref.index, targetIndex: p.lodIndex, sourceKey: key(ref), targetKey: key(targetRef), status };
  });
  if (lodLinks.some(link => !['local', 'resolved-static'].includes(link.status))) notices.push('Some LOD links need an external static IPL array or an unavailable placement/model; see metadata.');
  const collisionPlan = planSceneCollision(scene);
  const visibility = sceneVisibilityBounds(scene);
  scene.forEach((part, i) => { part.visibilityBounds = visibility.bounds[i]; });
  notices.push(...visibility.notices);
  if (collisionPlan.lodTargets) notices.push(`${collisionPlan.lodTargets} resolved LOD replacements are excluded from playable collision.`);
  notices.push('Raw placements only: LOD links, draw distances, collision and streaming are not applied.');
  return { scene, lodLinks, notices, collisionSource: collisionSources.sourceNames.join('; ') || undefined, placementSource, staticPlacementSource, requested: instances.length, omitted: missingIds + missingModels };
}
