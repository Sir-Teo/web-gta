import {orderedConcurrent} from './orderedConcurrent';
import type {ModelGeometryCache} from './ModelGeometryCache';
import {distantModelTextures} from './distantModelTextures';
import { inArea, selectSceneRegion, type SceneRegion } from './sceneRegion';
import { readSceneCollisionSources, type SceneCollisionSources } from './sceneCollisionSources';
import { readScenePlacements, type PlacementRef, type ScenePlacementSources } from './scenePlacements';
import { requireAsset } from './binary';
import { type IplInstance } from './ipl';
import { readImgIndex, type ImgEntry } from './img';
import { sceneVisibilityBounds, type SceneVisibilityBounds } from './sceneBounds';
import { planSceneCollision, isDistanceBigBuilding } from './sceneCollision';
import { timeModelCounterparts } from './timeModels';
import type { IdeAssociation } from './ide';
import { readModel, ModelReadCache } from './readModel';
export interface SceneRequest extends ScenePlacementSources, SceneCollisionSources { staticPlacementFile?: File; modelFiles?: File[]; textureFiles?: File[]; region?: SceneRegion; collisionFile?: File; collisionEntry?: ImgEntry; associations: IdeAssociation[]; parents: [string, string][]; interior: number; }
export type ScenePart = Awaited<ReturnType<typeof readModel>> & { name: string; placements: IplInstance[]; /** The main thread holds this model: its payload was left out of the window message (see residentModels.ts). */ resident?: boolean; sourceIndices?: number[]; sourceRefs?: PlacementRef[]; placementFormat?: 'text' | 'binary'; definition?: IdeAssociation; timeCounterpart?: string; visibilityBounds?: SceneVisibilityBounds };
/** `resident` names models the caller still holds: their parts carry only collision and placements, no decode (see residentModels.ts). */
export async function readScene(request: SceneRequest,geometryCache?:ModelGeometryCache,modelCache?:ModelReadCache,concurrency=8,resident?:ReadonlySet<string>) {
  requireAsset(Number.isInteger(request.interior) && request.interior >= 0 && request.interior <= 255, 'Interior must be an integer from 0 to 255.');
  const clock=()=>(typeof performance!=='undefined'?performance.now():Date.now());let mark=clock();const timings:Record<string,number>={};const lap=(name:string)=>{const now=clock();timings[name]=+(now-mark).toFixed(1);mark=now;};
  const placementsData = await readScenePlacements(request), entries = await readImgIndex(request.file);lap('placements');
  const { placementSource, staticPlacementSource, rows, byKey, key } = placementsData;
  const byName = new Map(request.associations.map(a => [a.model.toLowerCase(), a])), byId = new Map<number, IdeAssociation>();
  for (const a of request.associations) {
    requireAsset(!byId.has(a.id) || byId.get(a.id)!.model.toLowerCase() === a.model.toLowerCase(), `Ambiguous IDE model ID ${a.id}.`); byId.set(a.id, a);
  }
  const counterparts = timeModelCounterparts(request.associations);
  const groups = new Map<string, IplInstance[]>(), notices = [...placementsData.warnings]; let missingIds = 0;
  const refs = new Map(rows.map(row => [row.placement, row.ref]));
  const collisionSources = await readSceneCollisionSources(request, entries);lap('collisions');
  const collisionModels = collisionSources.models;
  const collisionByName=new Map(collisionModels?.map(model=>[model.name.toLowerCase(),model]));
  const instances = selectSceneRegion(rows, request.interior, request.region,p=>{
    const name=p.modelName??byId.get(p.modelId)?.model;
    return name?collisionByName.get(name.toLowerCase())?.bounds:undefined;
  },p=>{const distance=byId.get(p.modelId)?.drawDistance;return p.lodIndex<0&&isDistanceBigBuilding(distance)?distance:undefined;});
  requireAsset(instances.length > 0 && instances.length <= 4096, 'Scene requires 1–4,096 placements in the selected interior.');
  for (const instance of instances) {
    const name = (instance.modelName ?? byId.get(instance.modelId)?.model)?.toLowerCase();
    if (!name) { missingIds++; continue; }
    if (!groups.has(name)) groups.set(name, []); groups.get(name)!.push(instance);
  }
  if (request.region) notices.push(`Scene area uses placement origins within ${request.region.radius} units of native XY ${request.region.x}, ${request.region.y}, plus linked LOD ancestors. Objects with distant origins may cross the boundary.`);
  if(request.region?.includeCollisionBounds)notices.push('Area selection also includes intersecting transformed COL bounds. Missing COL bounds use placement origins; visual geometry can extend beyond collision bounds.');
  if (missingIds) notices.push(`${missingIds} placements lack an IDE model definition.`);
  requireAsset(groups.size<=1024&&[...groups.keys()].filter(name=>!isDistanceBigBuilding(byName.get(name)?.drawDistance)).length<=512, 'Scene exceeds its detailed/distant model limits.');
  const modelFiles=request.modelFiles??[],supplements=new Map<string,File>();
  requireAsset(modelFiles.length<=256&&modelFiles.reduce((sum,f)=>sum+f.size,0)<=128*1024*1024,'Supplemental models exceed the 256-file or 128 MiB limit.');
  for(const file of modelFiles){
    const name=file.name.toLowerCase();
    requireAsset(/^[^\\/]+\.dff$/.test(name)&&file.size>0&&file.size<=64*1024*1024,`Invalid supplemental model: ${file.name}.`);
    requireAsset(!supplements.has(name),`Ambiguous supplemental model: ${file.name}.`);supplements.set(name,file);
  }
  const nearNames=new Set(selectSceneRegion(rows,request.interior,request.region?{...request.region,lodRadius:undefined}:undefined,p=>{const name=p.modelName??byId.get(p.modelId)?.model;return name?collisionByName.get(name.toLowerCase())?.bounds:undefined;}).map(p=>(p.modelName??byId.get(p.modelId)?.model)?.toLowerCase()));
  const cache = modelCache?.matches(request.file,request.textureFiles) ? modelCache : new ModelReadCache(request.file, entries, request.textureFiles,geometryCache), countedPixels = new Set<ArrayBufferLike>();
  if (cache.externalDictionaries.size) notices.push(`External scene dictionaries override same-name archived dictionaries: ${[...cache.externalDictionaries.keys()].join(', ')}`);
  const scene: ScenePart[] = []; let memory = 0, triangles = 0, nodes = 0, missingModels = 0;
  const byEntryName = new Map(entries.map(entry => [entry.name.toLowerCase(), entry]));
  lap('select');
  const loads = orderedConcurrent(groups, async ([name, placements]) => {
    const entry = byEntryName.get(`${name}.dff`);
    const modelFile=entry?undefined:supplements.get(`${name}.dff`);
    if (!entry&&!modelFile) return {name, placements};
    const dictionary = byName.get(name)?.dictionary ?? name;
    const textureEntry = byEntryName.get(`${dictionary.toLowerCase()}.txd`);
    const textureFile = cache.externalDictionaries.get(`${dictionary.toLowerCase()}.txd`);
    let part: Awaited<ReturnType<typeof readModel>> | undefined, corrupt: string | undefined;
    // A resident model is not decoded again: the main thread puts its own copy back. World models keep their
    // collision in COL files, so the part's collision comes from the same lookup readModel makes.
    if (resident?.has(name) && entry) part = { model: { frames: [], geometries: [], atomics: [], warnings: [] }, textures: [], dictionaryNames: [], notices: [], collision: collisionByName.get(name), collisionSource: undefined };
    // A model whose bytes do not decode is treated like one absent from the archive: CStreaming draws nothing for
    // it and the rest of the sector still loads. Failing the whole window would strand the player at its edge.
    else try { part = await readModel({ file: request.file, entry, modelFile, textureFile, textureEntry, collisionModels, parents: request.parents }, cache); }
    catch (error) { corrupt = error instanceof Error ? error.message : String(error); }
    return {name, placements, part, corrupt, modelFile, textureEntry, textureFile, dictionary};
  }, concurrency);
  for await (const {name, placements, part, corrupt, modelFile, textureEntry, textureFile, dictionary} of loads) {
    if (!part) { missingModels += placements.length; notices.push(corrupt ? `Corrupt model: ${name}.dff (${placements.length} placements): ${corrupt}` : `Missing model: ${name}.dff (${placements.length} placements).`); continue; }
    if(!nearNames.has(name)&&part.textures.length)part.textures=distantModelTextures(part.textures);
    if(modelFile)part.notices.push(`Supplemental model: ${modelFile.name}; absent from ${request.file.name}.`);
    if (!textureEntry && !textureFile) part.notices.push(`Missing dictionary: ${dictionary}.txd.`);
    const bound = new Set(part.textures.map(t => t.name.toLowerCase()));
    const missing = [...new Set(part.model.geometries.flatMap(g => g.materials.map(m => m.texture).filter(n => n && !bound.has(n.toLowerCase()))))];
    if (missing.length) part.notices.push(`Unbound textures: ${missing.join(', ')}`);
    for (const geometry of part.model.geometries) for (const a of [geometry.positions, geometry.normals, geometry.colors, geometry.nightColors, geometry.indices, geometry.materialIds, geometry.skin?.indices, geometry.skin?.weights, geometry.skin?.inverseMatrices, geometry.skin?.usedBones, ...geometry.uvs]) memory += a?.byteLength ?? 0;
    for (const texture of part.textures) for (const mip of texture.mips) if (!countedPixels.has(mip.data.buffer)) { memory += mip.data.byteLength; countedPixels.add(mip.data.buffer); }
    triangles += placements.length * part.model.atomics.filter(a => a.flags & 4).reduce((n, a) => n + part.model.geometries[a.geometry].indices.length / 3, 0);
    nodes += placements.length * (part.model.frames.length + part.model.atomics.length);
    requireAsset(memory <= 128 * 1024 * 1024 && triangles <= 2000000 && nodes <= 100000, `Scene exceeds its decoded memory, triangle or hierarchy limit (${memory} bytes, ${triangles} triangles, ${nodes} nodes).`);
    scene.push({ ...part, collisionSource: collisionSources.origins.get(name), name, placements, sourceIndices: placements.map(p => refs.get(p)!.index), sourceRefs: placements.map(p => refs.get(p)!), placementFormat: request.additionalDistricts?.length || placementsData.hasStatic ? undefined : rows[0]?.ref.format, definition: byName.get(name), timeCounterpart: counterparts.get(name) });
  }
  lap('models');
  requireAsset(scene.length > 0, 'No scene models could be resolved from the selected archive and definitions.');
  const loaded = new Set(scene.flatMap(part => part.sourceRefs!.map(key)));
  const lodLinks = instances.filter(p => p.lodIndex >= 0).map(p => {
    const ref = refs.get(p)!, targetRef = ref.lodTarget!, target = byKey.get(key(targetRef))?.placement;
    const status = targetRef.namespace === 'static' && !placementsData.hasStatic ? 'external-static-array' : !target ? 'missing-placement' : !inArea(target.interior,request.interior) ? 'other-interior' : !loaded.has(key(targetRef)) ? 'missing-model' : ref.namespace !== targetRef.namespace ? 'resolved-static' : 'local';
    return { sourceIndex: ref.index, targetIndex: p.lodIndex, sourceKey: key(ref), targetKey: key(targetRef), status };
  });
  if (lodLinks.some(link => !['local', 'resolved-static'].includes(link.status))) notices.push('Some LOD links need an external static IPL array or an unavailable placement/model; see metadata.');
  const collisionPlan = planSceneCollision(scene);
  const visibility = sceneVisibilityBounds(scene);
  scene.forEach((part, i) => { part.visibilityBounds = visibility.bounds[i]; });lap('bounds');
  notices.push(...visibility.notices);
  if (collisionPlan.lodTargets) notices.push(`${collisionPlan.lodTargets} resolved LOD replacements are excluded from playable collision.`);
  notices.push('Raw placements only: LOD links, draw distances, collision and streaming are not applied.');
  if(placementsData.timecycleBoxes.length)notices.push(`${placementsData.timecycleBoxes.length} regional timecycle modifiers retained; playable color, fog and regional low-LOD scaling require a local timecycle table.`);
  return { timings, timecycleBoxes:placementsData.timecycleBoxes, scene, lodLinks, notices, region: request.region ? {...request.region} : undefined, collisionSource: collisionSources.sourceNames.join('; ') || undefined, placementSource, staticPlacementSource, requested: instances.length, omitted: missingIds + missingModels };
}
