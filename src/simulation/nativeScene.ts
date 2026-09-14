import type RAPIER from '@dimforge/rapier3d-compat';
import { Group, Matrix4, type Scene } from 'three';
import type { ScenePart } from '../assets/scene';
import { placedModelObjects } from '../assets/ModelObjects';
import { TexturePool } from '../assets/TexturePool';
import { installNativeCollision, type NativeCollisionSource } from './nativeCollision';
import { requireAsset } from '../assets/binary';
import { wrapMinutes } from '../world/timecycle';
import { planSceneCollision } from '../assets/sceneCollision';
import type { IplInstance } from '../assets/ipl';
import { sceneVisibility } from '../render/sceneVisibility';
import { nativeDayNightBalance } from '../world/nativeDayNight';
import { buildingLightingState } from '../assets/buildingMaterial';
import { sampleTimecycle } from '../world/timecycle';
import {placedEntityKind,type ObjectDataRecord} from '../assets/objectData';
import {nativeShadowReceivers} from './nativeShadowReceivers';
import {catalogScenePlacements,planSceneWindow,type ScenePlacementCatalog} from '../assets/sceneWindowPlan';
import type {ShadowFootprint} from '../render/projectShadowReceiver';
export interface InstalledCollisionSource { modelName: string; placement: IplInstance; source: NativeCollisionSource; entityKind:'building'|'dummy'|'unknown'; }
type VisibilityCamera = Parameters<ReturnType<typeof sceneVisibility>['update']>[0];
type PhysicalObject=ReturnType<typeof installNativeCollision>;
interface SceneOptions {allowMissingCollision?:boolean;datasetIdentity?:string;}
const physicsOwnership=new WeakMap<InstalledNativeScene,{owned:Set<PhysicalObject>;active:()=>boolean}>();
export interface InstalledNativeScene {
  area:number;root:Group;sources:Map<number,InstalledCollisionSource>;missingCollision:string[];
  shadowReceivers:(footprint:ShadowFootprint,projection?:Matrix4)=>ReturnType<typeof nativeShadowReceivers>;
  setObjectData:(definitions?:ReadonlyMap<string,ObjectDataRecord>)=>void;
  setTime:(minutes:number,ambient?:[number,number,number],lightMultiplier?:number)=>void;
  updateView:(camera:VisibilityCamera,lowLodScale?:number)=>void;
  visibleModels:()=>string[];readonly visibleInstanceCount:number;instanceCount:number;colliderCount:number;reusedColliderCount:number;reusedPlacementCount:number;
  setNight:(amount:number)=>void;dispose:()=>void;
  /** Synchronous full replacement. Publish the returned owner before the next
   * world step/render; failure leaves this owner intact. Collision reuse requires
   * an explicit immutable dataset identity for the destination. */
  replace:(parts:ScenePart[],validate?:(candidate:InstalledNativeScene)=>void,datasetIdentity?:string)=>InstalledNativeScene;
}
/** Commit imported visuals and fixed colliders as one owned scene, rolling back partial work on failure. */
export function installNativeScene(world: RAPIER.World, scene: Scene, parts: ScenePart[], options:SceneOptions={}):InstalledNativeScene {
  return buildNativeScene(world,scene,parts,{...options});
}
function buildNativeScene(world:RAPIER.World,scene:Scene,parts:ScenePart[],options:SceneOptions,borrowed=new Map<string,PhysicalObject>(),preparedCatalog?:ScenePlacementCatalog,sharedTextures?:TexturePool):InstalledNativeScene {
  scene.updateMatrixWorld(true);
  requireAsset(scene.matrixWorld.equals(new Matrix4()), 'Imported physics requires an untransformed scene root.');
  requireAsset(parts.length > 0 && parts.length <= 512, 'Imported scene requires 1–512 model types.');
  const areas=new Set(parts.flatMap(part=>part.placements.map(p=>p.interior)));
  const area=areas.values().next().value;
  requireAsset(areas.size===1&&Number.isInteger(area)&&area!>=0&&area!<=255,'Imported scene requires one valid area from 0 to 255.');
  let instances = 0, colliders = 0, triangles = 0, vertices = 0, visualTriangles = 0, visualNodes = 0;
  const collisionPlan = planSceneCollision(parts), missingCollision = collisionPlan.missing;
  for (const [partIndex, part] of parts.entries()) {
    const definition = part.definition;
    if (definition?.section === 'tobj' && (definition.timeOn !== undefined || definition.timeOff !== undefined)) requireAsset([definition.timeOn, definition.timeOff].every(n => n !== undefined && Number.isInteger(n) && n >= 0 && n <= 24), 'Timed scene objects require valid on/off hours.');
    instances += part.placements.length;
    visualTriangles += part.placements.length * part.model.atomics.filter(a => a.flags & 4).reduce((n, a) => n + part.model.geometries[a.geometry].indices.length / 3, 0);
    visualNodes += part.placements.length * (part.model.frames.length + part.model.atomics.length);
    if (!part.collision) continue;
    const collision = part.collision, count = collisionPlan.placements[partIndex].length;
    colliders += count * (collision.spheres.length + collision.boxes.length + Number(collision.mesh.indices.length > 0));
    triangles += count * collision.mesh.indices.length / 3; vertices += count * collision.mesh.positions.length / 3;
  }
  requireAsset(options.allowMissingCollision || !missingCollision.length, `Missing collision for: ${missingCollision.join(', ')}.`);
  requireAsset(instances > 0 && instances <= 4096 && colliders <= 20000 && triangles <= 2000000 && vertices <= 1000000 && visualTriangles <= 2000000 && visualNodes <= 100000, 'Imported scene exceeds the physics installation limits.');
  const catalog=options.datasetIdentity!==undefined?(preparedCatalog??catalogScenePlacements(parts,options.datasetIdentity)):undefined;
  const placementKeys=new Map<string,string>();
  for(const entry of catalog?.entries.values()??[])placementKeys.set(`${entry.part}:${entry.placement}`,entry.key);
  const keyedPhysical=new Map<string,PhysicalObject>();let reusedColliderCount=0,reusedPlacementCount=0;
  const root = new Group(), pool = sharedTextures ?? new TexturePool(options.datasetIdentity), visuals: ReturnType<typeof placedModelObjects>[] = [], physical = new Set<PhysicalObject>();
  const buildingLighting = buildingLightingState();
  const sources = new Map<number, InstalledCollisionSource>(); let disposed = false;
  let visibility: ReturnType<typeof sceneVisibility> | undefined;
  const dispose = () => {
    if (disposed) return; disposed = true;
    root.removeFromParent(); visibility?.dispose(); physical.forEach(p => p.dispose()); visuals.forEach(v => v.dispose()); sources.clear();physical.clear();keyedPhysical.clear();
  };
  try {
    for (const [partIndex, part] of parts.entries()) {
      const visual = placedModelObjects(part.model, part.textures, part.placements, pool, { buildingLighting }); visuals.push(visual); root.add(visual.root);
      if (part.collision) for (const index of collisionPlan.indices[partIndex]) {
        const placement=part.placements[index],key=placementKeys.get(`${partIndex}:${index}`),retained=key===undefined?undefined:borrowed.get(key);
        const object=retained??installNativeCollision(world,part.collision,placement);
        if(retained){reusedPlacementCount++;reusedColliderCount+=object.sources.size;}else physical.add(object);
        if(key!==undefined)keyedPhysical.set(key,object);
        object.sources.forEach((source, handle) => sources.set(handle, { modelName: part.name, placement, source,entityKind:'unknown' }));
      }
    }
    root.updateMatrixWorld(true); scene.add(root);
  } catch (error) { dispose(); throw error; }
  try { visibility = sceneVisibility(parts, visuals.map(v => v.root)); } catch (error) { dispose(); throw error; }
  const loadedModels = new Set(parts.map(part => part.name.toLowerCase()));
  let objectData:ReadonlyMap<string,ObjectDataRecord>|undefined;
  let clock:{minutes:number;ambient?:[number,number,number];lightMultiplier:number}|undefined;
  let nightOverride:number|undefined,view:{camera:VisibilityCamera;scale:number}|undefined;
  const setObjectData=(definitions?:ReadonlyMap<string,ObjectDataRecord>)=>{
    if(disposed)return;
    objectData=definitions;
    for(const source of sources.values())source.entityKind=placedEntityKind(source.modelName,definitions);
  };
  const shadowReceivers=(footprint:ShadowFootprint,projection?:import('three').Matrix4)=>{
    requireAsset(!disposed,'Imported shadow scene is disposed.');
    return nativeShadowReceivers(world,sources,footprint,{},projection);
  };
  let lastHour: number | undefined;
  const setTime = (minutes: number, ambient?: [number,number,number],lightMultiplier=1) => {
    if (disposed) return;
    requireAsset(Number.isFinite(minutes), 'Scene time must be finite.');
    requireAsset(Number.isFinite(lightMultiplier)&&lightMultiplier>=.6&&lightMultiplier<=1,'Invalid sun light multiplier.');
    const balance = nativeDayNightBalance(minutes);
    buildingLighting.night.value = balance;
    buildingLighting.ambient.value.set(...(ambient ?? sampleTimecycle(minutes).ambient)).multiplyScalar(lightMultiplier);
    visuals.forEach(visual => visual.setNight(balance));
    clock={minutes,ambient:ambient?[...ambient]:undefined,lightMultiplier};nightOverride=undefined;
    const hour = Math.floor(wrapMinutes(minutes) / 60); if (hour === lastHour) return;
    for (let i = 0; i < parts.length; i++) {
      const definition = parts[i].definition;
      if (definition?.section !== 'tobj' || definition.timeOn === undefined || definition.timeOff === undefined) continue;
      const { timeOn: from, timeOff: to } = definition;
      const inRange = from > to ? hour >= from || hour < to : hour >= from && hour < to;
      const counterpart = parts[i].timeCounterpart;
      visuals[i].root.visible = inRange || !!counterpart && !loadedModels.has(counterpart.toLowerCase());
    }
    lastHour = hour;
  };
  const updateView=(camera:VisibilityCamera,lowLodScale=1)=>{
    if(disposed)return;visibility!.update(camera,lowLodScale);view={camera,scale:lowLodScale};
  };
  const setNight=(amount:number)=>{if(!disposed){visuals.forEach(v=>v.setNight(amount));nightOverride=amount;}};
  const replace=(nextParts:ScenePart[],validate?:(candidate:InstalledNativeScene)=>void,datasetIdentity?:string):InstalledNativeScene=>{
    requireAsset(!disposed,'Cannot replace a disposed imported scene.');
    // Installation and state preparation are synchronous: no simulation step or
    // render may run while old and new colliders temporarily coexist.
    const nextCatalog=datasetIdentity!==undefined?catalogScenePlacements(nextParts,datasetIdentity):undefined;
    const reuse=new Map<string,PhysicalObject>();
    if(catalog&&nextCatalog)for(const entry of planSceneWindow(catalog,nextCatalog).retained){
      const object=keyedPhysical.get(entry.key);if(entry.physical&&object)reuse.set(entry.key,object);
    }
    const next=buildNativeScene(world,scene,nextParts,{...options,datasetIdentity},reuse,nextCatalog,datasetIdentity!==undefined&&datasetIdentity===options.datasetIdentity?pool:undefined);
    try{
      next.setObjectData(objectData);
      if(clock)next.setTime(clock.minutes,clock.ambient,clock.lightMultiplier);
      if(nightOverride!==undefined)next.setNight(nightOverride);
      if(view)next.updateView(view.camera,view.scale);
      validate?.(next);
      requireAsset(physicsOwnership.get(next)!.active(),'Candidate scene was disposed during validation.');
    }catch(error){next.dispose();throw error;}
    // Borrowing never transfers ownership before all candidate validation passes.
    // Rollback destroys only newly allocated bodies. Commit moves each retained
    // body to the next owner before the previous owner retires its remainder.
    for(const object of reuse.values()){physical.delete(object);physicsOwnership.get(next)!.owned.add(object);}
    dispose();return next;
  };
  const installed:InstalledNativeScene={ area:area!, root, sources, shadowReceivers, missingCollision, setObjectData, setTime, updateView, visibleModels: () => disposed ? [] : visibility!.models(), get visibleInstanceCount() { return disposed ? 0 : visibility!.count; }, instanceCount: instances, colliderCount: colliders, reusedColliderCount,reusedPlacementCount,setNight, dispose, replace };
  physicsOwnership.set(installed,{owned:physical,active:()=>!disposed});return installed;
}
