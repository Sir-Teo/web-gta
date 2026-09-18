import {nativeAmbientState} from '../assets/nativeMaterial';
import {nativeGrassWind,type NativeGrassWindState} from '../world/nativeGrassWind';
import RAPIER from '@dimforge/rapier3d-compat';
import { Group, Matrix4, Quaternion, Vector3, type Scene } from 'three';
import { placementMatrix } from '../assets/placement';
import type { ScenePart } from '../assets/scene';
import { placedModelObjects } from '../assets/ModelObjects';
import { TexturePool } from '../assets/TexturePool';
import { installNativeCollision, type NativeCollisionSource } from './nativeCollision';
import { requireAsset } from '../assets/binary';
import { wrapMinutes } from '../world/timecycle';
import { isDistanceBigBuilding, planSceneCollision } from '../assets/sceneCollision';
import type { IplInstance } from '../assets/ipl';
import { sceneVisibility } from '../render/sceneVisibility';
import { nativeDayNightBalance } from '../world/nativeDayNight';
import { buildingLightingState } from '../assets/buildingMaterial';
import { sampleTimecycle } from '../world/timecycle';
import {placedEntityKind,type ObjectDataRecord} from '../assets/objectData';
import {nativeShadowReceivers} from './nativeShadowReceivers';
import {catalogScenePlacements,planSceneWindow,type ScenePlacementCatalog} from '../assets/sceneWindowPlan';
import type {ShadowFootprint} from '../render/projectShadowReceiver';
import {WalkingVegetation,type WalkingVegetationPackage} from '../world/WalkingVegetation';
export type InstalledCollisionSource = {modelName:string;source:NativeCollisionSource;entityKind:'building'|'dummy'|'object'|'unknown'} & ({placement:IplInstance;procedural?:false;matrix?:never}|{placement?:never;procedural:true;matrix:Matrix4});
type VisibilityCamera = Parameters<ReturnType<typeof sceneVisibility>['update']>[0];
type PhysicalObject=ReturnType<typeof installNativeCollision>;
export interface UprootPhysics {mass:number;turnMass:number;elasticity:number;damping:number;linvel:{x:number;y:number;z:number};angvel:{x:number;y:number;z:number}}
interface SceneOptions {allowMissingCollision?:boolean;datasetIdentity?:string;vegetation?:WalkingVegetationPackage;}
const physicsOwnership=new WeakMap<InstalledNativeScene,{owned:Set<PhysicalObject>;active:()=>boolean}>();
export interface InstalledNativeScene {
  area:number;root:Group;sources:Map<number,InstalledCollisionSource>;missingCollision:string[];
  shadowReceivers:(footprint:ShadowFootprint,projection?:Matrix4)=>ReturnType<typeof nativeShadowReceivers>;
  setObjectData:(definitions?:ReadonlyMap<string,ObjectDataRecord>)=>void;
  setTime:(minutes:number,ambient?:[number,number,number],lightMultiplier?:number,objectAmbient?:readonly number[])=>void;
  updateView:(camera:VisibilityCamera,lowLodScale?:number,wind?:NativeGrassWindState,simulateVegetation?:boolean)=>void;
  visibleModels:()=>string[];readonly visibleInstanceCount:number;instanceCount:number;colliderCount:number;reusedColliderCount:number;reusedPlacementCount:number;
  setNight:(amount:number)=>void;dispose:()=>void;
  /** Turns off a placement's collision and rendering, as CObject::ObjectDamage does; returns its collision sources (spheres, boxes, then mesh) and its scene part. */
  removePlacement:(handle:number)=>{sources:readonly NativeCollisionSource[];part:ScenePart}|undefined;
  /** Unfreezes a placement's fixed body into a dynamic one with OBJECT.DAT mass, as
   * CPhysical::ApplyCollision does when an impact exceeds the uproot limit. Velocities are m/s and rad/s. */
  uprootPlacement:(handle:number,physics:UprootPhysics)=>boolean;
  /** Moves uprooted visuals onto their bodies; returns each moving placement's pose for persistence. */
  syncMoving:()=>{handle:number;translation:{x:number;y:number;z:number};rotation:{x:number;y:number;z:number;w:number}}[];
  vegetation:()=>ReturnType<WalkingVegetation['snapshot']>|undefined;
  /** Synchronous full replacement. Publish the returned owner before the next
   * world step/render; failure leaves this owner intact. Collision reuse requires
   * an explicit immutable dataset identity for the destination. */
  replace:(parts:ScenePart[],validate?:(candidate:InstalledNativeScene)=>void,datasetIdentity?:string,vegetation?:WalkingVegetationPackage)=>InstalledNativeScene;
}
/** Commit imported visuals and fixed colliders as one owned scene, rolling back partial work on failure. */
/** A placement's renderer matrix with its translation removed: the visual relative to a body placed at its origin. */
const rotationOnly=(placement:IplInstance)=>placementMatrix(placement).setPosition(0,0,0);
export function installNativeScene(world: RAPIER.World, scene: Scene, parts: ScenePart[], options:SceneOptions={}):InstalledNativeScene {
  return buildNativeScene(world,scene,parts,{...options});
}
function buildNativeScene(world:RAPIER.World,scene:Scene,parts:ScenePart[],options:SceneOptions,borrowed=new Map<string,PhysicalObject>(),preparedCatalog?:ScenePlacementCatalog,sharedTextures?:TexturePool):InstalledNativeScene {
  scene.updateMatrixWorld(true);
  requireAsset(scene.matrixWorld.equals(new Matrix4()), 'Imported physics requires an untransformed scene root.');
  requireAsset(parts.length > 0 && parts.length <= 1024 && parts.filter(part=>!isDistanceBigBuilding(part.definition?.drawDistance)).length<=512, 'Imported scene exceeds its detailed/distant model limits.');
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
  // Own the texture lists without modifying the caller's decoded payload. Each
  // model below adopts already-live pixel storage before acquiring its owner.
  parts=parts.map(part=>({...part,textures:part.textures.slice()}));
  const buildingLighting = buildingLightingState(), entityLighting=nativeAmbientState();
  const sources = new Map<number, InstalledCollisionSource>(); let disposed = false;
  const placementOf=new Map<number,{part:number;placement:number;object:PhysicalObject}>();
  let visibility: ReturnType<typeof sceneVisibility> | undefined;
  let vegetation:WalkingVegetation|undefined;
  const dispose = () => {
    if (disposed) return; disposed = true;
    root.removeFromParent(); vegetation?.dispose();vegetation=undefined;options.vegetation=undefined; visibility?.dispose(); physical.forEach(p => p.dispose()); visuals.forEach(v => v.dispose()); sources.clear();placementOf.clear();physical.clear();keyedPhysical.clear();
    // A caller may keep the disposed handle. Do not let its root or closures
    // retain the retired scene's meshes, decoded models and texture payloads.
    root.clear();visuals.length=0;parts=[];visibility=undefined;
  };
  const smashed:[number,number][]=[],moving=new Map<PhysicalObject,{part:number;placement:number;handle:number;local:Matrix4}>();
  try {
    for (const [partIndex, part] of parts.entries()) {
      part.textures=part.textures.map(texture=>pool.canonicalSource(texture));
      const visual = placedModelObjects(part.model, part.textures, part.placements, pool, { buildingLighting,worldLighting:true,ambient:entityLighting }); visuals.push(visual); root.add(visual.root);
      if (part.collision) for (const index of collisionPlan.indices[partIndex]) {
        const placement=part.placements[index],key=placementKeys.get(`${partIndex}:${index}`),retained=key===undefined?undefined:borrowed.get(key);
        const object=retained??installNativeCollision(world,part.collision,placement);
        // A prop smashed in the previous window stays smashed while it remains streamed in.
        if(retained){reusedPlacementCount++;reusedColliderCount+=object.sources.size;if(object.body.isValid()&&!object.body.isEnabled())smashed.push([partIndex,index]);if(object.body.isValid()&&object.body.isDynamic())moving.set(object,{part:partIndex,placement:index,handle:object.sources.keys().next().value!,local:rotationOnly(placement)});}else physical.add(object);
        if(key!==undefined)keyedPhysical.set(key,object);
        object.sources.forEach((source, handle) => {sources.set(handle, { modelName: part.name, placement, source,entityKind:'unknown' });placementOf.set(handle,{part:partIndex,placement:index,object});});
      }
    }
    root.updateMatrixWorld(true); scene.add(root);
  } catch (error) { dispose(); throw error; }
  try { visibility = sceneVisibility(parts, visuals.map(v => v.root));for(const [part,placement] of smashed)visibility.remove(part,placement); } catch (error) { dispose(); throw error; }
  try{if(options.vegetation){vegetation=new WalkingVegetation(parts,options.vegetation,area!,world,sources);root.add(vegetation.root);}}catch(error){dispose();throw error;}
  const loadedModels = new Set(parts.map(part => part.name.toLowerCase()));
  let objectData:ReadonlyMap<string,ObjectDataRecord>|undefined;
  let clock:{minutes:number;ambient?:[number,number,number];lightMultiplier:number;objectAmbient?:readonly number[]}|undefined;
  let nightOverride:number|undefined,view:{camera:VisibilityCamera;scale:number;wind?:NativeGrassWindState;simulateVegetation:boolean}|undefined;
  const setObjectData=(definitions?:ReadonlyMap<string,ObjectDataRecord>)=>{
    if(disposed)return;
    objectData=definitions;
    for(const source of sources.values())if(!source.procedural)source.entityKind=placedEntityKind(source.modelName,definitions);
  };
  const shadowReceivers=(footprint:ShadowFootprint,projection?:import('three').Matrix4)=>{
    requireAsset(!disposed,'Imported shadow scene is disposed.');
    return nativeShadowReceivers(world,sources,footprint,{},projection);
  };
  let lastHour: number | undefined;
  let lastView:{x:number;y:number;z:number;scale:number;time:number}|undefined;
  const setTime = (minutes: number, ambient?: [number,number,number],lightMultiplier=1,objectAmbient?:readonly number[]) => {
    if (disposed) return;
    requireAsset(Number.isFinite(minutes), 'Scene time must be finite.');
    requireAsset(Number.isFinite(lightMultiplier)&&lightMultiplier>=.6&&lightMultiplier<=1,'Invalid sun light multiplier.');
    requireAsset(!objectAmbient||objectAmbient.length===3&&objectAmbient.every(v=>Number.isFinite(v)&&v>=0),'Invalid placed entity ambient.');
    // Static IPL buildings and dummies use CEntity::SetupLighting. The
    // unreversed generated-light factor is explicitly neutral (1).
    entityLighting.enabled.value=!!objectAmbient;entityLighting.directMultiplier.value=.5;
    if(objectAmbient)entityLighting.color.value.set(objectAmbient[0],objectAmbient[1],objectAmbient[2]).multiplyScalar(.5*lightMultiplier);
    const balance = nativeDayNightBalance(minutes);
    buildingLighting.night.value = balance;
    buildingLighting.ambient.value.set(...(ambient ?? sampleTimecycle(minutes).ambient)).multiplyScalar(lightMultiplier);
    visuals.forEach(visual => visual.setNight(balance));
    vegetation?.setAmbient(buildingLighting.ambient.value.toArray());
    vegetation?.setEntityLighting(ambient??sampleTimecycle(minutes).ambient,objectAmbient,lightMultiplier);
    clock={minutes,ambient:ambient?[...ambient]:undefined,lightMultiplier,objectAmbient:objectAmbient?[...objectAmbient]:undefined};nightOverride=undefined;
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
  const updateView=(camera:VisibilityCamera,lowLodScale=1,wind?:NativeGrassWindState,simulateVegetation=true)=>{
    if(disposed)return;
    if(wind)nativeGrassWind(wind.milliseconds,wind.wind,wind.seed);
    // Visibility over thousands of placements costs CPU per frame. Throttle to
    // camera motion: native streaming is distance-based, not per-frame. Reuse
    // the last selection until the camera moved 1.5 m, rotated, or 150 ms passed.
    const pos=camera.position as {x:number;y:number;z:number};
    const now=typeof performance!=='undefined'?performance.now():0;
    const moved=lastView===undefined||Math.hypot(pos.x-lastView.x,pos.y-lastView.y,pos.z-lastView.z)>1.5||Math.abs(lowLodScale-lastView.scale)>1e-3||now-lastView.time>150;
    if(moved){visibility!.update(camera,lowLodScale);lastView={x:pos.x,y:pos.y,z:pos.z,scale:lowLodScale,time:now};}
    vegetation?.update(camera,nightOverride??buildingLighting.night.value,wind,simulateVegetation);view={camera,scale:lowLodScale,wind:wind?{...wind}:undefined,simulateVegetation};
  };
  const setNight=(amount:number)=>{if(!disposed){visuals.forEach(v=>v.setNight(amount));nightOverride=amount;}};
  const replace=(nextParts:ScenePart[],validate?:(candidate:InstalledNativeScene)=>void,datasetIdentity?:string,nextVegetation?:WalkingVegetationPackage):InstalledNativeScene=>{
    requireAsset(!disposed,'Cannot replace a disposed imported scene.');
    // Installation and state preparation are synchronous: no simulation step or
    // render may run while old and new colliders temporarily coexist.
    const nextCatalog=datasetIdentity!==undefined?catalogScenePlacements(nextParts,datasetIdentity):undefined;
    const reuse=new Map<string,PhysicalObject>();
    if(catalog&&nextCatalog)for(const entry of planSceneWindow(catalog,nextCatalog).retained){
      const object=keyedPhysical.get(entry.key);if(entry.physical&&object)reuse.set(entry.key,object);
    }
    const next=buildNativeScene(world,scene,nextParts,{...options,datasetIdentity,vegetation:nextVegetation??(datasetIdentity!==undefined&&datasetIdentity===options.datasetIdentity?options.vegetation:undefined)},reuse,nextCatalog,datasetIdentity!==undefined&&datasetIdentity===options.datasetIdentity?pool:undefined);
    try{
      next.setObjectData(objectData);
      if(clock)next.setTime(clock.minutes,clock.ambient,clock.lightMultiplier,clock.objectAmbient);
      if(nightOverride!==undefined)next.setNight(nightOverride);
      if(view)next.updateView(view.camera,view.scale,view.wind,view.simulateVegetation);
      validate?.(next);
      requireAsset(physicsOwnership.get(next)!.active(),'Candidate scene was disposed during validation.');
    }catch(error){next.dispose();throw error;}
    // Borrowing never transfers ownership before all candidate validation passes.
    // Rollback destroys only newly allocated bodies. Commit moves each retained
    // body to the next owner before the previous owner retires its remainder.
    for(const object of reuse.values()){physical.delete(object);physicsOwnership.get(next)!.owned.add(object);}
    dispose();return next;
  };
  const uprootPlacement=(handle:number,o:UprootPhysics)=>{
    const owner=placementOf.get(handle);if(disposed||!owner)return false;
    const body=owner.object.body;if(!body.isValid()||!body.isEnabled()||body.isDynamic())return false;
    for(const h of owner.object.sources.keys()){const c=world.getCollider(h);if(c){c.setDensity(0);c.setRestitution(o.elasticity);}}
    body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);
    // CObject's centre of mass is its origin, which is where the fixed body was placed.
    body.setAdditionalMassProperties(o.mass,{x:0,y:0,z:0},{x:o.turnMass,y:o.turnMass,z:o.turnMass},{x:0,y:0,z:0,w:1},true);
    body.setLinearDamping(o.damping);body.setAngularDamping(o.damping);
    body.setLinvel(o.linvel,true);body.setAngvel(o.angvel,true);
    moving.set(owner.object,{part:owner.part,placement:owner.placement,handle,local:rotationOnly(parts[owner.part].placements[owner.placement])});
    return true;
  };
  const bodyMatrix=new Matrix4(),bodyPosition=new Vector3(),bodyRotation=new Quaternion(),unit=new Vector3(1,1,1),visualMatrix=new Matrix4();
  const syncMoving=()=>{
    if(disposed)return [];
    const out:ReturnType<InstalledNativeScene['syncMoving']>=[];
    for(const [object,entry] of moving){
      const body=object.body;if(!body.isValid()){moving.delete(object);continue;}
      const t=body.translation(),r=body.rotation();
      bodyMatrix.compose(bodyPosition.set(t.x,t.y,t.z),bodyRotation.set(r.x,r.y,r.z,r.w),unit);
      visibility?.move(entry.part,entry.placement,visualMatrix.multiplyMatrices(bodyMatrix,entry.local));
      out.push({handle:entry.handle,translation:{x:t.x,y:t.y,z:t.z},rotation:{x:r.x,y:r.y,z:r.z,w:r.w}});
    }
    return out;
  };
  const removePlacement=(handle:number)=>{
    const owner=placementOf.get(handle);if(disposed||!owner||!owner.object.body.isValid()||!owner.object.body.isEnabled())return undefined;
    owner.object.body.setEnabled(false);visibility?.remove(owner.part,owner.placement);return {sources:[...owner.object.sources.values()],part:parts[owner.part]};
  };
  const installed:InstalledNativeScene={ area:area!, root, sources, shadowReceivers, missingCollision, setObjectData, setTime, updateView, removePlacement, uprootPlacement, syncMoving, vegetation:()=>vegetation?.snapshot(), visibleModels: () => disposed ? [] : visibility!.models(), get visibleInstanceCount() { return disposed ? 0 : visibility!.count; }, instanceCount: instances, colliderCount: colliders, reusedColliderCount,reusedPlacementCount,setNight, dispose, replace };
  physicsOwnership.set(installed,{owned:physical,active:()=>!disposed});return installed;
}
