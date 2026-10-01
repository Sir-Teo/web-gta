import {nativeAmbientState,type NativeAmbientState} from '../assets/nativeMaterial';
import {nativeGrassWind,type NativeGrassWindState} from '../world/nativeGrassWind';
import RAPIER from '@dimforge/rapier3d-compat';
import { Group, Matrix4, Mesh, Quaternion, Vector3, type Scene } from 'three';
import { nativePlacementMatrix, placementMatrix } from '../assets/placement';
import { tagKey } from '../world/nativeTagManager';
import type { ScenePart } from '../assets/scene';
import { ModelObjectPool, placedModelObjects } from '../assets/ModelObjects';
import { TexturePool } from '../assets/TexturePool';
import { installNativeCollision, forgetColliderReach, type NativeCollisionSource } from './nativeCollision';
import { requireAsset } from '../assets/binary';
import { wrapMinutes } from '../world/timecycle';
import { isDistanceBigBuilding, planSceneCollision } from '../assets/sceneCollision';
import type { IplInstance } from '../assets/ipl';
import { sceneVisibility } from '../render/sceneVisibility';
import { nativeDayNightBalance } from '../world/nativeDayNight';
import { buildingLightingState, type BuildingLightingState } from '../assets/buildingMaterial';
import { sampleTimecycle } from '../world/timecycle';
import {placedEntityKind,type ObjectDataRecord} from '../assets/objectData';
import {nativeShadowReceivers} from './nativeShadowReceivers';
import {catalogScenePlacements,planSceneWindow,type ScenePlacementCatalog} from '../assets/sceneWindowPlan';
import type {ShadowFootprint} from '../render/projectShadowReceiver';
import {WalkingVegetation,type WalkingVegetationPackage} from '../world/WalkingVegetation';
export type InstalledCollisionSource = {modelName:string;source:NativeCollisionSource;entityKind:'building'|'dummy'|'object'|'unknown'} & ({placement:IplInstance;procedural?:false;matrix?:never}|{placement?:never;procedural:true;matrix:Matrix4});
type VisibilityCamera = Parameters<ReturnType<typeof sceneVisibility>['update']>[0];
type PhysicalObject=ReturnType<typeof installNativeCollision>;
type Visual=ReturnType<typeof placedModelObjects>;
/** The parts of the next window built ahead of its commit: visuals per part index and colliders for placements the
 * current window lacks, keyed as the catalog does. `replace` consumes what it uses; the caller disposes the rest. */
export interface PrebuiltWindow {catalog:ScenePlacementCatalog;visuals:Map<number,Visual>;physical:Map<string,PhysicalObject>;/** The placement visibility graph over `visuals`, built last; the commit adopts it when it took every visual. */visibility?:ReturnType<typeof sceneVisibility>;dispose:()=>void}
/** A budgeted job that builds a PrebuiltWindow a few milliseconds per frame (CStreaming loads models across frames
 * before an entity renders; here the model instances and new collision are made ahead of the window commit). */
export interface PrebuildJob {step:(budgetMs:number)=>boolean;result:()=>PrebuiltWindow|undefined;dispose:()=>void;readonly progress:{parts:number;partsDone:number;colliders:number;collidersDone:number}}
export interface UprootPhysics {mass:number;turnMass:number;elasticity:number;damping:number;linvel:{x:number;y:number;z:number};angvel:{x:number;y:number;z:number}}
interface SceneOptions {allowMissingCollision?:boolean;datasetIdentity?:string;vegetation?:WalkingVegetationPackage;
 /** CCustomRoadsignMgr: the sign text meshes attached to placements whose models carry roadsign 2d effects. */
 roadsigns?:import('../render/NativeRoadsigns').NativeRoadsigns;
 /** COcclusion: the visibility pass culls placements behind the frame's active occluders. */
 occlusion?:import('../render/sceneVisibility').SceneOcclusion;}
const physicsOwnership=new WeakMap<InstalledNativeScene,{owned:Set<PhysicalObject>;active:()=>boolean}>();
/** Which window owns its dataset's model-source pool: the one that created it, or the successor it was handed to. */
const poolOwnership=new WeakMap<InstalledNativeScene,{adopt:()=>void}>();
export interface InstalledNativeScene {
  area:number;root:Group;sources:Map<number,InstalledCollisionSource>;missingCollision:string[];
  shadowReceivers:(footprint:ShadowFootprint,projection?:Matrix4)=>ReturnType<typeof nativeShadowReceivers>;
  setObjectData:(definitions?:ReadonlyMap<string,ObjectDataRecord>)=>void;
  /** `frame` is the 30 fps game frame; without it every model's prelight takes the time's balance at once. */
  setTime:(minutes:number,ambient?:[number,number,number],lightMultiplier?:number,objectAmbient?:readonly number[],frame?:number)=>void;
  updateView:(camera:VisibilityCamera,lowLodScale?:number,wind?:NativeGrassWindState,simulateVegetation?:boolean,tunnels?:{tunnels:boolean;outside:boolean})=>void;
  /** Placements the last view update culled behind occluders (CRenderer::SetupEntityVisibility). */
  occludedCount:()=>number;
  /** Placements whose models carry 2d effect lights and that the renderer holds in range this frame. */
  litPlacements:()=>import('../world/nativeEntityLights').LitEntity[];
  /** CEntity::CreateEffects' particle effects: each placement's named FX at the effect position under its native
   * modelling matrix (RwMatrix right, up, at, pos). `effectsVersion` changes when effects are supplied. */
  particlePlacements:()=>{key:string;name:string;position:[number,number,number];matrix:number[]}[];readonly effectsVersion:number;
  /** CEscalators: each escalator 2d effect of the placed models, with its placement's native modelling matrix. */
  escalatorPlacements:()=>{key:string;effect:import('../assets/twoDEffect').ModelEscalatorEffect;position:[number,number,number];matrix:number[]}[];
  /** Ped attractor effects of the placed models within `radius` of a native point: the effect's world position and
   * its queue, use and forward directions in native space (CPedAttractorManager::ComputeEffectPos and friends). */
  attractorsNear:(x:number,y:number,radius:number)=>WorldAttractor[];
  modelPlacementsNear:(models:ReadonlySet<string>,x:number,y:number,radius:number)=>{key:string;model:string;position:[number,number,number];heading:number}[];
  modelTriggerPoint:(model:string,index:number)=>[number,number,number]|undefined;
  setModelPlacementTaken:(key:string,taken:boolean)=>boolean;
  /** The tag placements' keys (tagKey) and CTagManager::SetAlpha's material alpha for one. */
  tagKeys:()=>string[];setTagAlpha:(key:string,alpha:number)=>void;
  /** Model names, and the 2d effects the scene package left out, supplied per geometry by model name. */
  partNames:()=>string[];supplyEffects:(effects:Readonly<Record<string,import('../assets/twoDEffect').Model2dEffect[][]>>)=>number;
  visibleModels:()=>string[];placementsNear:(x:number,z:number,radius:number)=>{name:string;distance:number;visible:boolean;selected:boolean;covered:boolean;hasLod:boolean;parent:string|null;children:number;drawDistance:number;y:number}[];readonly visibleInstanceCount:number;instanceCount:number;colliderCount:number;reusedColliderCount:number;reusedPlacementCount:number;
  /** Model sources this window shares with its dataset's pool (built once, kept across windows while in use), and the
   * retired ones the pool keeps within its byte budget for a window that comes back. */
  readonly pooledModelCount:number;readonly retiredModelCount:number;readonly retiredModelMB:number;
  /** The decoded models of the pool's retired sources, by model name, for the next request's resident list. */
  retiredModels:()=>Map<string,import('../assets/ModelObjects').HeldModel>;
  /** Milliseconds per stage of this window's synchronous build. */
  readonly buildStages:Readonly<Record<string,number>>;
  /** CEntity::PreRender's MaterialUpdateUVAnimCB over every animated material in the window: adds the frame's
   * seconds and applies the texture transforms. `uvAnimatorCount` is how many materials animate. */
  advanceUvAnimations:(seconds:number)=>void;readonly uvAnimatorCount:number;
  setNight:(amount:number)=>void;dispose:()=>void;
  /** Turns off a placement's collision and rendering, as CObject::ObjectDamage does; returns its collision sources (spheres, boxes, then mesh) and its scene part. */
  removePlacement:(handle:number)=>{sources:readonly NativeCollisionSource[];part:ScenePart}|undefined;
  /** CEntity::bIsVisible off or back on for a placement, its collision left alone; false for a smashed one. */
  setPlacementHidden:(handle:number,hidden:boolean)=>boolean;
  /** CEntity::bUsesCollision for a placement: its colliders taken out of the world or put back. */
  setPlacementCollision:(handle:number,on:boolean)=>boolean;
  /** The part, placement and collision sources behind a collider handle, without touching them. */
  placementInfo:(handle:number)=>{part:ScenePart;placement:IplInstance;sources:readonly NativeCollisionSource[]}|undefined;
  /** Unfreezes a placement's fixed body into a dynamic one with OBJECT.DAT mass, as
   * CPhysical::ApplyCollision does when an impact exceeds the uproot limit. Velocities are m/s and rad/s. */
  uprootPlacement:(handle:number,physics:UprootPhysics)=>boolean;
  /** Moves uprooted visuals onto their bodies; returns each moving placement's pose for persistence. */
  syncMoving:()=>{handle:number;translation:{x:number;y:number;z:number};rotation:{x:number;y:number;z:number;w:number}}[];
  /** CObject::ProcessControl's settling, once a game frame: returns the handles that went static again. */
  settleMoving:()=>number[];
  /** The collision bounding-sphere radius of the placement owning a collider. */
  placementRadius:(handle:number)=>number|undefined;
  vegetation:()=>ReturnType<WalkingVegetation['snapshot']>|undefined;
  /** Synchronous full replacement. Publish the returned owner before the next
   * world step/render; failure leaves this owner intact. Collision reuse requires
   * an explicit immutable dataset identity for the destination. */
  replace:(parts:ScenePart[],validate?:(candidate:InstalledNativeScene)=>void,datasetIdentity?:string,vegetation?:WalkingVegetationPackage,prebuilt?:PrebuiltWindow)=>InstalledNativeScene;
  /** Starts building the next window's model instances and new colliders ahead of `replace`, for the same dataset. */
  prebuild:(parts:ScenePart[],datasetIdentity?:string)=>PrebuildJob|undefined;
  /** The collider handles the next window will own once committed from a pre-built window: the placements retained
   * from this window plus the pre-built ones. A support check can run against them before anything is built. */
  previewHandles:(prebuilt:PrebuiltWindow)=>number[];
}
/** Commit imported visuals and fixed colliders as one owned scene, rolling back partial work on failure. */
/** A placement's renderer matrix with its translation removed: the visual relative to a body placed at its origin. */
const rotationOnly=(placement:IplInstance)=>placementMatrix(placement).setPosition(0,0,0);
export interface WorldAttractor {
 key:string;model:string;type:number;scriptName:string;probability:number;
 position:[number,number,number];queueDir:[number,number,number];useDir:[number,number,number];forwardDir:[number,number,number];
}
export function installNativeScene(world: RAPIER.World, scene: Scene, parts: ScenePart[], options:SceneOptions={}):InstalledNativeScene {
  return buildNativeScene(world,scene,parts,{...options});
}
/** Resources one window hands to the next within the same immutable dataset: the texture and model-source pools,
 * and the lighting state objects the pooled materials read their uniforms from. */
interface SharedSceneResources {textures:TexturePool;sources:ModelObjectPool;buildingLighting:BuildingLightingState;entityLighting:NativeAmbientState}
/** CRenderer's pass order: RenderRoads draws IDE road models (flag 1) first, RenderEverythingBarRoads the rest, and
 * then the visible LOD list (big buildings, draw distance over 300) with the camera's zShift lowered by 100, a depth
 * bias that pushes the LODs behind anything drawn at the same depth. A LOD that shares a surface with a detail model
 * it is not linked to (the East Los Santos billboards) therefore stays hidden behind it, as in the original. */
function applyRenderPass(part:ScenePart,root:Group){
  const road=((part.definition?.flags??0)&1)!==0,lod=!road&&isDistanceBigBuilding(part.definition?.drawDistance);
  if(!road&&!lod)return;
  root.traverse(o=>{
    if(!(o instanceof Mesh))return;
    o.renderOrder=road?-2:1;
    if(lod)for(const material of [o.material].flat()){if(material.polygonOffset)continue;material.polygonOffset=true;material.polygonOffsetFactor=1;material.polygonOffsetUnits=4;material.needsUpdate=true;}
  });
}
/** CBaseModelInfo::m_nAlpha of the models in the live window, by lowercase name (see sceneVisibility's partAlpha).
 * The first window loads like CStreaming's loading scene (255); a later window's newly streamed models start at 0. */
let modelAlphas=new Map<string,number>();
/** The live window's model alphas below 255, for tests and the dev hooks. */
export const fadingModelCount=()=>{let n=0;for(const a of modelAlphas.values())if(a<255)n++;return n;};
function buildNativeScene(world:RAPIER.World,scene:Scene,parts:ScenePart[],options:SceneOptions,borrowed=new Map<string,PhysicalObject>(),preparedCatalog?:ScenePlacementCatalog,shared?:SharedSceneResources,prebuilt?:PrebuiltWindow):InstalledNativeScene {
  // Only the scene's own transform matters here; a forced update of the whole scene graph cost milliseconds per swap.
  scene.updateWorldMatrix(true,false);
  requireAsset(scene.matrixWorld.equals(new Matrix4()), 'Imported physics requires an untransformed scene root.');
  requireAsset(parts.length > 0 && parts.length <= 1024 && parts.filter(part=>!isDistanceBigBuilding(part.definition?.drawDistance)).length<=512, 'Imported scene exceeds its detailed/distant model limits.');
  // AREA_CODE_13 placements show in every area; the scene's own area is the other one.
  const areas=new Set(parts.flatMap(part=>part.placements.map(p=>p.interior)).filter(a=>a!==13));
  const area=areas.size?areas.values().next().value:13;
  requireAsset(areas.size<=1&&Number.isInteger(area)&&area!>=0&&area!<=255,'Imported scene requires one valid area from 0 to 255.');
  let instances = 0, colliders = 0, triangles = 0, vertices = 0, visualTriangles = 0, visualNodes = 0;
  const stageClock=()=>typeof performance!=='undefined'?performance.now():0;let stageMark=stageClock();
  /** Milliseconds per build stage of this window, for the dev state. */
  const stages={plan:0,catalog:0,build:0,visibility:0,vegetation:0};
  const stage=(key:keyof typeof stages)=>{const now=stageClock();stages[key]+=now-stageMark;stageMark=now;};
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
  stage('plan');
  const catalog=options.datasetIdentity!==undefined?(preparedCatalog??catalogScenePlacements(parts,options.datasetIdentity)):undefined;
  stage('catalog');
  const placementKeys=new Map<string,string>();
  for(const entry of catalog?.entries.values()??[])placementKeys.set(`${entry.part}:${entry.placement}`,entry.key);
  const keyedPhysical=new Map<string,PhysicalObject>();let reusedColliderCount=0,reusedPlacementCount=0;
  const root = new Group();root.matrixAutoUpdate=false;
  const pool = shared?.textures ?? new TexturePool(options.datasetIdentity), sourcePool = shared?.sources ?? new ModelObjectPool(), visuals: ReturnType<typeof placedModelObjects>[] = [], physical = new Set<PhysicalObject>();
  // Own the texture lists without modifying the caller's decoded payload. Each
  // model below adopts already-live pixel storage before acquiring its owner.
  parts=parts.map(part=>({...part,textures:part.textures.slice()}));
  const buildingLighting = shared?.buildingLighting ?? buildingLightingState(), entityLighting=shared?.entityLighting ?? nativeAmbientState();
  const sources = new Map<number, InstalledCollisionSource>(); let disposed = false;
  /** The window that created the pool disposes its retired sources at the end, unless a same-dataset successor adopted it. */
  let ownsPool = shared === undefined;
  const placementOf=new Map<number,{part:number;placement:number;object:PhysicalObject}>();
  let visibility: ReturnType<typeof sceneVisibility> | undefined;
  let vegetation:WalkingVegetation|undefined;
  const dispose = () => {
    if (disposed) return; disposed = true;
    root.removeFromParent(); vegetation?.dispose();vegetation=undefined;options.vegetation=undefined; visibility?.dispose(); physical.forEach(p => p.dispose()); visuals.forEach(v => v.dispose()); sources.clear();placementOf.clear();physical.clear();keyedPhysical.clear();
    // The last window of a dataset takes the pool's retired sources with it; a successor keeps them.
    if(ownsPool){ownsPool=false;sourcePool.dispose();}
    // A caller may keep the disposed handle. Do not let its root or closures
    // retain the retired scene's meshes, decoded models and texture payloads.
    root.clear();visuals.length=0;parts=[];visibility=undefined;
  };
  const smashed:[number,number][]=[],moving=new Map<PhysicalObject,{part:number;placement:number;handle:number;local:Matrix4;
    /** m_vecForce, m_vecTorque (the averaged move and turn speed, native units a frame) and m_nFakePhysics. */
    force?:{x:number;y:number;z:number};torque?:{x:number;y:number;z:number};still?:number}>();
  let allPrebuilt=!!prebuilt;
  /** Parts whose visuals this commit built itself; pre-built ones already took their render pass in the job. */
  const builtHere:number[]=[];
  try {
    for (const [partIndex, part] of parts.entries()) {
      part.textures=part.textures.map(texture=>pool.canonicalSource(texture));
      // Within one dataset a model name identifies immutable bytes: the built source is shared across windows.
      const ready=prebuilt?.visuals.get(partIndex);if(ready)prebuilt!.visuals.delete(partIndex);else{allPrebuilt=false;builtHere.push(partIndex);}
      const visual = ready ?? placedModelObjects(part.model, part.textures, part.placements, pool, { buildingLighting,worldLighting:true,ambient:entityLighting,flatten:true }, options.datasetIdentity===undefined?undefined:{sources:sourcePool,key:part.name.toLowerCase()}); visuals.push(visual); root.add(visual.root);
      if (part.collision) for (const index of collisionPlan.indices[partIndex]) {
        const placement=part.placements[index],key=placementKeys.get(`${partIndex}:${index}`),retained=key===undefined?undefined:borrowed.get(key);
        const built=key===undefined?undefined:prebuilt?.physical.get(key);if(built!==undefined)prebuilt!.physical.delete(key!);
        const object=retained??built??installNativeCollision(world,part.collision,placement);
        // A prop smashed in the previous window stays smashed while it remains streamed in.
        if(retained){reusedPlacementCount++;reusedColliderCount+=object.sources.size;if(object.body.isValid()&&!object.body.isEnabled())smashed.push([partIndex,index]);if(object.body.isValid()&&object.body.isDynamic())moving.set(object,{part:partIndex,placement:index,handle:object.sources.keys().next().value!,local:rotationOnly(placement)});}else physical.add(object);
        if(key!==undefined)keyedPhysical.set(key,object);
        object.sources.forEach((source, handle) => {sources.set(handle, { modelName: part.name, placement, source,entityKind:'unknown' });placementOf.set(handle,{part:partIndex,placement:index,object});});
      }
    }
    // CEntity::CreateEffects' roadsign atomics on every placement instance (also after effects are supplied).
    if(options.roadsigns)parts.forEach((part,p)=>options.roadsigns!.attach(part.model,visuals[p].root.children));
    // Every visual's hierarchy already holds its world matrices (placedModelObjects updates them under an identity
    // root), and this root is the identity too: forcing the whole window again cost milliseconds per swap.
    root.updateWorldMatrix(false,false); scene.add(root);
  } catch (error) { dispose(); throw error; }
  stage('build');
  // CRenderer::RenderRoads draws IDE road models (flag 1) before everything else; the wet-road corona reflections come
  // between them and the rest.
  for(const p of builtHere)applyRenderPass(parts[p],visuals[p].root);
  // The pre-build job hands over its visibility graph when this commit took every one of its visuals (the graph
  // indexes those clones); otherwise it is built here.
  const readyVisibility=allPrebuilt&&prebuilt?.visibility&&parts.length===visuals.length?prebuilt.visibility:undefined;
  if(readyVisibility)prebuilt!.visibility=undefined;
  try { visibility = readyVisibility??sceneVisibility(parts, visuals.map(v => v.root), options.occlusion);for(const [part,placement] of smashed)visibility.remove(part,placement);
    const streamed=!!shared,nextAlphas=new Map<string,number>();
    parts.forEach((part,i)=>{const name=part.name.toLowerCase(),alpha=modelAlphas.get(name)??(streamed?0:255);visibility!.partAlpha[i]=alpha;nextAlphas.set(name,alpha);});
    modelAlphas=nextAlphas; } catch (error) { dispose(); throw error; }
  stage('visibility');
  // CTagManager: IDE tag models (flag 0x100000) draw their second material, the player's tag, at the tag's alpha;
  // CTagManager::SetupAtomic starts it at 0.
  const tagPlacements=new Map<string,{part:number;placement:number}>();
  parts.forEach((part,p)=>{if(!((part.definition?.flags??0)&0x100000))return;part.placements.forEach((placement,i)=>{tagPlacements.set(tagKey(placement.position),{part:p,placement:i});visibility!.setMaterialAlpha(p,i,1,0);});});
  const setTagAlpha=(key:string,alpha:number)=>{const at=tagPlacements.get(key);if(at&&!disposed)visibility?.setMaterialAlpha(at.part,at.placement,1,alpha);};
  try{if(options.vegetation){vegetation=new WalkingVegetation(parts,options.vegetation,area!,world,sources);root.add(vegetation.root);}}catch(error){dispose();throw error;}
  stage('vegetation');
  const loadedModels = new Set(parts.map(part => part.name.toLowerCase()));
  let objectData:ReadonlyMap<string,ObjectDataRecord>|undefined;
  let clock:{minutes:number;ambient?:[number,number,number];lightMultiplier:number;objectAmbient?:readonly number[]}|undefined;
  let nightOverride:number|undefined,view:{camera:VisibilityCamera;scale:number;wind?:NativeGrassWindState;simulateVegetation:boolean;tunnels?:{tunnels:boolean;outside:boolean}}|undefined;
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
  let lastView:{x:number;y:number;z:number;scale:number;time:number;fx:number;fy:number;fz:number;fov:number;tunnels:boolean;outside:boolean}|undefined,frameAcc=0;
  let lastPrelightFrame:number|undefined;
  const setTime = (minutes: number, ambient?: [number,number,number],lightMultiplier=1,objectAmbient?:readonly number[],frame?:number) => {
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
    // Without a game frame the prelight takes the balance at once, as a newly created entity does. Once a game frame,
    // each model CRenderer::PreRender reaches runs CCustomBuildingDNPipeline::PreRenderUpdate.
    if(frame===undefined)visuals.forEach(visual => visual.setNight(balance));
    else if(frame!==lastPrelightFrame&&visibility){lastPrelightFrame=frame;const reached=visibility.partPreRendered;for(let i=0;i<visuals.length;i++)if(reached[i])visuals[i].preRenderUpdate(balance,frame);}
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
  // Renderer frame back to native: the placement matrix is rotateX(-π/2) × native.
  const toNative=new Matrix4().makeRotationX(Math.PI/2),nativeMatrix=new Matrix4();
  const litStatic=new Map<number,{id:number;seed:number;name:string;effects:import('../assets/twoDEffect').Model2dEffect[]}>();
  const litPlacements=()=>{
    if(disposed||!visibility)return [];
    return visibility.litInRange().map(({index,part,matrix})=>{
      let fixed=litStatic.get(index);
      // m_nRandomSeed is a rand() at creation; a hash of the entry keeps it stable across frames.
      if(!fixed){fixed={id:(index+1)*256,seed:(Math.imul(index+1,2654435761)>>>17)&0x7fff,name:parts[part].name.toLowerCase(),effects:parts[part].model.geometries.flatMap(g=>g.effects??[])};litStatic.set(index,fixed);}
      return {...fixed,matrix:nativeMatrix.multiplyMatrices(toNative,matrix).elements.slice()};
    });
  };
  let effectsVersion=0;
  const partNames=()=>parts.map(part=>part.name);
  const particlePlacements=()=>{
    const out:{key:string;name:string;position:[number,number,number];matrix:number[]}[]=[];
    parts.forEach((part,p)=>{
      const effects=part.model?.geometries.flatMap(g=>g.effects??[]).filter(e=>e.particle)??[];
      if(!effects.length)return;
      part.placements.forEach((placement,i)=>{
        const e=nativePlacementMatrix(placement).elements,matrix=[e[0],e[1],e[2],e[4],e[5],e[6],e[8],e[9],e[10],e[12],e[13],e[14]];
        effects.forEach((effect,k)=>out.push({key:`${p}:${i}:${k}`,name:effect.particle!,position:[...effect.position],matrix}));
      });
    });
    return out;
  };
  const escalatorPlacements=()=>{
    const out:{key:string;effect:import('../assets/twoDEffect').ModelEscalatorEffect;position:[number,number,number];matrix:number[]}[]=[];
    parts.forEach((part,p)=>{
      const effects=part.model?.geometries.flatMap(g=>g.effects??[]).filter(e=>e.escalator)??[];
      if(!effects.length)return;
      part.placements.forEach((placement,i)=>{
        const e=nativePlacementMatrix(placement).elements,matrix=[e[0],e[1],e[2],e[4],e[5],e[6],e[8],e[9],e[10],e[12],e[13],e[14]];
        effects.forEach((effect,k)=>out.push({key:`${p}:${i}:${k}`,effect:effect.escalator!,position:[...effect.position],matrix}));
      });
    });
    return out;
  };
  /** The parts whose models carry ped attractor effects, with those effects: fixed until effects are supplied. */
  let attractorParts:{version:number;parts:{part:ScenePart;effects:import('../assets/twoDEffect').Model2dEffect[]}[]}|undefined;
  /** The placements of the named models (lower case) within `radius` of a native point: the dummies CObject would be
   * made from, for the script brains attached to their models. The heading is the placement's turn about the
   * vertical, degrees. */
  const modelPlacementsNear=(models:ReadonlySet<string>,x:number,y:number,radius:number)=>{
    const out:{key:string;model:string;position:[number,number,number];heading:number}[]=[],r2=radius*radius;
    for(const part of parts){
      if(!models.has(part.name.toLowerCase()))continue;
      part.placements.forEach((placement,i)=>{
        const [px,py,pz]=placement.position;
        if((px-x)*(px-x)+(py-y)*(py-y)>r2)return;
        const e=nativePlacementMatrix(placement).elements;
        out.push({key:`${part.name}:${i}:${px.toFixed(1)}:${py.toFixed(1)}`,model:part.name,position:[px,py,pz],heading:Math.atan2(-e[4],e[5])*180/Math.PI});
      });
    }
    return out;
  };
  /** A placement modelPlacementsNear listed (by its key) is taken out of the map, or put back: a script that moves the
   * CObject made from it draws and collides its own copy meanwhile. */
  const setModelPlacementTaken=(key:string,taken:boolean)=>{
    if(disposed)return false;
    const [name,index]=key.split(':'),part=parts.findIndex(p=>p.name===name),placement=Number(index);
    if(part<0||!Number.isInteger(placement))return false;
    for(const owner of new Set(placementOf.values()))if(owner.part===part&&owner.placement===placement&&owner.object.body.isValid())owner.object.body.setEnabled(!taken);
    if(visibility){if(taken)visibility.remove(part,placement);else visibility.restore(part,placement);}
    return true;
  };
  /** CEntity::FindTriggerPointCoors' lookup on a model: its EFFECT_TRIGGER_POINT of that index, in the model's own
   * space, or nothing. */
  const modelTriggerPoint=(model:string,index:number)=>{
    const name=model.toLowerCase(),part=parts.find(p=>p.name.toLowerCase()===name);
    return part?.model?.geometries.flatMap(g=>g.effects??[]).find(e=>e.triggerPoint===index)?.position;
  };
  const attractorsNear=(x:number,y:number,radius:number)=>{
    const out:WorldAttractor[]=[],r2=radius*radius;
    if(attractorParts?.version!==effectsVersion){
      attractorParts={version:effectsVersion,parts:[]};
      for(const part of parts){const effects=part.model?.geometries.flatMap(g=>g.effects??[]).filter(e=>e.attractor)??[];if(effects.length)attractorParts.parts.push({part,effects});}
    }
    attractorParts.parts.forEach(({part,effects})=>{
      part.placements.forEach((placement,i)=>{
        const [px,py]=placement.position;
        if((px-x)*(px-x)+(py-y)*(py-y)>(radius+30)*(radius+30))return;
        const m=nativePlacementMatrix(placement),e=m.elements;
        const point=(v:[number,number,number]):[number,number,number]=>[e[0]*v[0]+e[4]*v[1]+e[8]*v[2]+e[12],e[1]*v[0]+e[5]*v[1]+e[9]*v[2]+e[13],e[2]*v[0]+e[6]*v[1]+e[10]*v[2]+e[14]];
        const dir=(v:[number,number,number]):[number,number,number]=>[e[0]*v[0]+e[4]*v[1]+e[8]*v[2],e[1]*v[0]+e[5]*v[1]+e[9]*v[2],e[2]*v[0]+e[6]*v[1]+e[10]*v[2]];
        effects.forEach((effect,k)=>{
          const position=point(effect.position);
          if((position[0]-x)*(position[0]-x)+(position[1]-y)*(position[1]-y)>r2)return;
          const a=effect.attractor!;
          out.push({key:`${part.name}:${i}:${k}`,model:part.name,type:a.type,scriptName:a.scriptName,probability:a.probability,position,queueDir:dir(a.queueDir),useDir:dir(a.useDir),forwardDir:dir(a.forwardDir)});
        });
      });
    });
    return out;
  };
  const supplyEffects=(effects:Readonly<Record<string,import('../assets/twoDEffect').Model2dEffect[][]>>)=>{
    let supplied=0;
    for(const part of parts){
      const byGeometry=effects[part.name.toLowerCase()];if(!byGeometry||part.model.geometries.some(g=>g.effects))continue;
      part.model.geometries.forEach((g,i)=>{if(byGeometry[i]?.length){g.effects=byGeometry[i];supplied++;}});
    }
    if(supplied){litStatic.clear();visibility?.refreshLit();effectsVersion++;if(options.roadsigns)parts.forEach((part,p)=>{if(visuals[p])options.roadsigns!.attach(part.model,visuals[p].root.children);});}
    return supplied;
  };
  const updateView=(camera:VisibilityCamera,lowLodScale=1,wind?:NativeGrassWindState,simulateVegetation=true,tunnels:{tunnels:boolean;outside:boolean}={tunnels:false,outside:true})=>{
    if(disposed)return;
    if(wind)nativeGrassWind(wind.milliseconds,wind.wind,wind.seed);
    // Visibility over thousands of placements costs CPU per frame. Throttle to
    // camera motion: native streaming is distance-based, not per-frame. Reuse
    // the last selection until the camera moved 1.5 m, rotated, or 150 ms passed.
    // Turning the camera is checked too (its forward moved past a dot of 0.98, or the FOV changed): the frustum culls
    // stale otherwise, leaving the leading edge of the view empty until the timer runs out.
    const pos=camera.position as {x:number;y:number;z:number},m=camera.matrixWorld.elements,fx=-m[8],fy=-m[9],fz=-m[10];
    const now=typeof performance!=='undefined'?performance.now():0;
    const moved=lastView===undefined||Math.hypot(pos.x-lastView.x,pos.y-lastView.y,pos.z-lastView.z)>1.5||Math.abs(lowLodScale-lastView.scale)>1e-3||now-lastView.time>150
     ||fx*lastView.fx+fy*lastView.fy+fz*lastView.fz<.98||camera.fov!==lastView.fov||tunnels.tunnels!==lastView.tunnels||tunnels.outside!==lastView.outside;
    // CStreaming fades newly streamed models in over the game frames: rescan every call while one is below 255.
    const alphas=visibility!.partAlpha,fadingIn=alphas.some(a=>a<255);
    frameAcc=fadingIn&&lastView?frameAcc+Math.max(0,now-lastView.time)*30/1000:0;const frames=Math.floor(frameAcc);frameAcc-=frames;
    if(moved||fadingIn){visibility!.update(camera,lowLodScale,tunnels,frames);if(fadingIn)parts.forEach((part,i)=>modelAlphas.set(part.name.toLowerCase(),alphas[i]));lastView={x:pos.x,y:pos.y,z:pos.z,scale:lowLodScale,time:now,fx,fy,fz,fov:camera.fov,tunnels:tunnels.tunnels,outside:tunnels.outside};}
    vegetation?.update(camera,nightOverride??buildingLighting.night.value,wind,simulateVegetation);view={camera,scale:lowLodScale,wind:wind?{...wind}:undefined,simulateVegetation,tunnels};
  };
  const setNight=(amount:number)=>{if(!disposed){visuals.forEach(v=>v.setNight(amount));nightOverride=amount;}};
  // Pooled sources are shared by successive windows, so each animator is advanced once per frame here.
  const uvAnimators=new Set(visuals.flatMap(v=>v.source.uvAnimators));
  const advanceUvAnimations=(seconds:number)=>{if(disposed||!(seconds>0))return;for(const animator of uvAnimators)animator.advance(seconds);};
  const prebuild=(nextParts:ScenePart[],datasetIdentity?:string):PrebuildJob|undefined=>{
    if(disposed||!catalog||datasetIdentity===undefined||datasetIdentity!==options.datasetIdentity)return undefined;
    const nextCatalog=catalogScenePlacements(nextParts,datasetIdentity),plan=planSceneWindow(catalog,nextCatalog),collisionPlan=planSceneCollision(nextParts);
    const added=new Set(plan.added.filter(e=>e.physical).map(e=>e.key)),keyOf=new Map<string,string>();
    for(const entry of nextCatalog.entries.values())keyOf.set(`${entry.part}:${entry.placement}`,entry.key);
    const colliders:{part:number;placement:number;key:string}[]=[];
    nextParts.forEach((part,p)=>{if(!part.collision)return;for(const index of collisionPlan.indices[p]){const key=keyOf.get(`${p}:${index}`);if(key!==undefined&&added.has(key))colliders.push({part:p,placement:index,key});}});
    const visuals=new Map<number,Visual>(),physical=new Map<string,PhysicalObject>();
    const progress={parts:nextParts.length,partsDone:0,colliders:colliders.length,collidersDone:0};
    let done=false,gone=false,visibility:ReturnType<typeof sceneVisibility>|undefined;
    const dispose=()=>{gone=true;visibility?.dispose();visibility=undefined;visuals.forEach(v=>v.dispose());visuals.clear();physical.forEach(o=>o.dispose());physical.clear();};
    const step=(budgetMs:number)=>{
      if(gone||disposed)return false;
      const until=(typeof performance!=='undefined'?performance.now():0)+budgetMs;
      while(progress.partsDone<nextParts.length){
        const p=progress.partsDone,part=nextParts[p];
        part.textures=part.textures.map(texture=>pool.canonicalSource(texture));
        visuals.set(p,placedModelObjects(part.model,part.textures,part.placements,pool,{buildingLighting,worldLighting:true,ambient:entityLighting,flatten:true},{sources:sourcePool,key:part.name.toLowerCase()}));
        progress.partsDone++;
        if((typeof performance!=='undefined'?performance.now():0)>=until)return false;
      }
      while(progress.collidersDone<colliders.length){
        const item=colliders[progress.collidersDone],part=nextParts[item.part];
        physical.set(item.key,installNativeCollision(world,part.collision!,part.placements[item.placement]));
        progress.collidersDone++;
        if((typeof performance!=='undefined'?performance.now():0)>=until)return false;
      }
      // Last, the visibility graph and per-placement fades over the built clones (the largest part of a commit
      // with the LOD ring streamed). Road models take their render order first, as the fades record it.
      if(!visibility){
        nextParts.forEach((part,p)=>applyRenderPass(part,visuals.get(p)!.root));
        visibility=sceneVisibility(nextParts,nextParts.map((_,p)=>visuals.get(p)!.root),options.occlusion);
      }
      done=true;return true;
    };
    return {step,result:()=>done&&!gone?{catalog:nextCatalog,visuals,physical,get visibility(){return visibility;},set visibility(v){visibility=v;},dispose}:undefined,dispose,progress};
  };
  const previewHandles=(prebuilt:PrebuiltWindow)=>{
    const handles:number[]=[];
    if(!disposed&&catalog)for(const entry of planSceneWindow(catalog,prebuilt.catalog).retained){const object=entry.physical?keyedPhysical.get(entry.key):undefined;if(object)handles.push(...object.sources.keys());}
    for(const object of prebuilt.physical.values())handles.push(...object.sources.keys());
    return handles;
  };
  const replace=(nextParts:ScenePart[],validate?:(candidate:InstalledNativeScene)=>void,datasetIdentity?:string,nextVegetation?:WalkingVegetationPackage,prebuilt?:PrebuiltWindow):InstalledNativeScene=>{
    requireAsset(!disposed,'Cannot replace a disposed imported scene.');
    // Installation and state preparation are synchronous: no simulation step or
    // render may run while old and new colliders temporarily coexist.
    const usable=prebuilt&&datasetIdentity!==undefined&&prebuilt.catalog.dataset===datasetIdentity?prebuilt:undefined;
    const nextCatalog=usable?.catalog??(datasetIdentity!==undefined?catalogScenePlacements(nextParts,datasetIdentity):undefined);
    const reuse=new Map<string,PhysicalObject>();
    if(catalog&&nextCatalog)for(const entry of planSceneWindow(catalog,nextCatalog).retained){
      const object=keyedPhysical.get(entry.key);if(entry.physical&&object)reuse.set(entry.key,object);
    }
    const sameDataset=datasetIdentity!==undefined&&datasetIdentity===options.datasetIdentity;
    const next=buildNativeScene(world,scene,nextParts,{...options,datasetIdentity,vegetation:nextVegetation??(sameDataset?options.vegetation:undefined)},reuse,nextCatalog,sameDataset?{textures:pool,sources:sourcePool,buildingLighting,entityLighting}:undefined,sameDataset?usable:undefined);
    const clockNow=()=>(typeof performance!=='undefined'?performance.now():0);let mark=clockNow();
    const lap=(name:string)=>{const now=clockNow();(next.buildStages as Record<string,number>)[name]=now-mark;mark=now;};
    try{
      next.setObjectData(objectData);
      if(clock)next.setTime(clock.minutes,clock.ambient,clock.lightMultiplier,clock.objectAmbient);
      if(nightOverride!==undefined)next.setNight(nightOverride);
      if(view)next.updateView(view.camera,view.scale,view.wind,view.simulateVegetation,view.tunnels);
      lap('setup');
      validate?.(next);
      requireAsset(physicsOwnership.get(next)!.active(),'Candidate scene was disposed during validation.');
      lap('validate');
    }catch(error){next.dispose();throw error;}
    // Borrowing never transfers ownership before all candidate validation passes.
    // Rollback destroys only newly allocated bodies. Commit moves each retained
    // body to the next owner before the previous owner retires its remainder.
    for(const object of reuse.values()){physical.delete(object);physicsOwnership.get(next)!.owned.add(object);}
    if(sameDataset&&ownsPool){ownsPool=false;poolOwnership.get(next)!.adopt();}
    dispose();lap('retire');return next;
  };
  const uprootPlacement=(handle:number,o:UprootPhysics)=>{
    const owner=placementOf.get(handle);if(disposed||!owner)return false;
    const body=owner.object.body;if(!body.isValid()||!body.isEnabled()||body.isDynamic())return false;
    for(const h of owner.object.sources.keys()){const c=world.getCollider(h);if(c){c.setDensity(0);c.setRestitution(o.elasticity);}}
    body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);forgetColliderReach(world,owner.object.sources.keys());
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
  /* CObject::ProcessControl (0x5A2130), once a 30 fps game frame: a loose prop averages its move and turn speed
   * (native units a frame) into m_vecForce and m_vecTorque; while both stay under TimeStep × 0.003 for more than 10
   * frames, it goes static again (SetIsStatic) with its speeds reset, so its uproot limit holds against the next hit. */
  const settleMoving=()=>{
    const settled:number[]=[];if(disposed)return settled;
    const limit=50/30*.003;
    for(const [object,entry] of moving){
      const body=object.body;if(!body.isValid()||!body.isDynamic())continue;
      const v=body.linvel(),w=body.angvel(),f=entry.force??{x:0,y:0,z:0},t=entry.torque??{x:0,y:0,z:0};
      entry.force={x:(f.x+v.x/50)/2,y:(f.y+v.y/50)/2,z:(f.z+v.z/50)/2};entry.torque={x:(t.x+w.x/50)/2,y:(t.y+w.y/50)/2,z:(t.z+w.z/50)/2};
      const moves=Math.hypot(entry.force.x,entry.force.y,entry.force.z)>=limit||Math.hypot(entry.torque.x,entry.torque.y,entry.torque.z)>=limit;
      entry.still=moves?0:(entry.still??0)+1;
      if(entry.still<=10)continue;
      body.setLinvel({x:0,y:0,z:0},false);body.setAngvel({x:0,y:0,z:0},false);body.setBodyType(RAPIER.RigidBodyType.Fixed,false);
      const r=body.translation(),q=body.rotation();
      bodyMatrix.compose(bodyPosition.set(r.x,r.y,r.z),bodyRotation.set(q.x,q.y,q.z,q.w),unit);
      visibility?.move(entry.part,entry.placement,visualMatrix.multiplyMatrices(bodyMatrix,entry.local));
      moving.delete(object);settled.push(entry.handle);
    }
    return settled;
  };
  const placementInfo=(handle:number)=>{
    const owner=placementOf.get(handle);if(disposed||!owner)return undefined;
    const part=parts[owner.part];return {part,placement:part.placements[owner.placement],sources:[...owner.object.sources.values()]};
  };
  const removePlacement=(handle:number)=>{
    const owner=placementOf.get(handle);if(disposed||!owner||!owner.object.body.isValid()||!owner.object.body.isEnabled())return undefined;
    owner.object.body.setEnabled(false);visibility?.remove(owner.part,owner.placement);return {sources:[...owner.object.sources.values()],part:parts[owner.part]};
  };
  const setPlacementHidden=(handle:number,hidden:boolean)=>{
    const owner=placementOf.get(handle);if(disposed||!owner||!owner.object.body.isValid()||!owner.object.body.isEnabled()||!visibility)return false;
    return hidden?visibility.remove(owner.part,owner.placement):visibility.restore(owner.part,owner.placement);
  };
  const setPlacementCollision=(handle:number,on:boolean)=>{
    const owner=placementOf.get(handle);if(disposed||!owner)return false;
    for(const h of owner.object.sources.keys())world.getCollider(h)?.setEnabled(on);
    return true;
  };
  const installed:InstalledNativeScene={ area:area!, root, sources, shadowReceivers, missingCollision, setObjectData, setTime, updateView, occludedCount:()=>visibility?.stats.occluded??0, escalatorPlacements, removePlacement, setPlacementHidden, setPlacementCollision, placementInfo, uprootPlacement, syncMoving, settleMoving, placementRadius:(handle:number)=>{const owner=placementOf.get(handle);return owner&&!disposed?parts[owner.part].collision?.bounds.radius:undefined;}, vegetation:()=>vegetation?.snapshot(), litPlacements, attractorsNear, modelPlacementsNear, modelTriggerPoint, setModelPlacementTaken,particlePlacements, tagKeys:()=>[...tagPlacements.keys()], setTagAlpha, get effectsVersion(){return effectsVersion;}, partNames, supplyEffects, visibleModels: () => disposed ? [] : visibility!.models(), placementsNear:(x:number,z:number,radius:number)=>disposed?[]:visibility!.near(x,z,radius), get visibleInstanceCount() { return disposed ? 0 : visibility!.count; }, instanceCount: instances, colliderCount: colliders, reusedColliderCount,reusedPlacementCount,get pooledModelCount(){return sourcePool.size;},get retiredModelCount(){return sourcePool.retiredCount;},get retiredModelMB(){return sourcePool.retiredMB;},retiredModels:()=>sourcePool.retiredModels(),buildStages:stages,prebuild,previewHandles,advanceUvAnimations,get uvAnimatorCount(){return uvAnimators.size;},setNight, dispose, replace };
  physicsOwnership.set(installed,{owned:physical,active:()=>!disposed});poolOwnership.set(installed,{adopt:()=>{ownsPool=true;}});return installed;
}
