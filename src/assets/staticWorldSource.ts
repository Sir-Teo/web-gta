import {ModelReadCache} from './readModel';
import {ModelGeometryCache} from './ModelGeometryCache';
import {readWorldIplLoadList} from './worldLoadList';
import {readInitialZonePopulation} from './scmZonePopulation';
import {readInitialPickups} from './scmPickups';
import {readInitialStuntJumps} from './scmStuntJumps';
import {readInitialSavePoints} from './scmSavePoints';
import {readInitialRadarBlips} from './scmRadarBlips';
import {readInitialRestartPoints} from './scmRestartPoints';
import {readInitialEntryExitSwitches} from './scmEntryExits';
import {readWorldEntryExits} from './worldEntryExits';
import {readIdeAssociations} from './ide';
import {readZones,prepareWorldZones} from './worldZones';
import {readWorldCarGenerators,carGeneratorsInRegion} from './worldCarGenerators';
import {openStaticWorld} from './staticWorldArchive';
import {prepareWorldFolder,type WorldFolderFile} from './worldFolder';
import {readScene} from './scene';
import {readSceneVegetation} from '../world/WalkingVegetation';
import {nativeScenePlantEntities} from '../world/nativeScenePlants';
import {readSceneCollisionSources} from './sceneCollisionSources';
import {readWorldTags} from './worldTags';
import {readInitialSetPieces} from './scmSetPieces';
import {readNativeProcAssets} from './nativeProcAssets';
import type {SceneRegion} from './sceneRegion';
/** The published static world opened once for a play session: the archive, the IDE/IPL planner over the active
 * load list, the script's initial state and the decode caches that later region reads share. The streaming worker
 * owns one; Node coverage runs open the same thing against a served `public/play/world`. */
export async function openStaticWorldSource(base:string){
 const source=await openStaticWorld(base),files:WorldFolderFile[]=[{path:'depot/gta3.img',file:source.file}];
 const resources=source.manifest.resources.filter(r=>!r.path.startsWith('vehicles/'));
 let index=0;await Promise.all(Array.from({length:6},async()=>{for(;;){const resource=resources[index++];if(!resource)return;files.push({path:'depot/'+resource.path,file:await source.resource(resource)});}}));
 // Parallel downloads must not change IDE/placement source ordering between loads.
 files.sort((a,b)=>a.path.localeCompare(b.path));
 const loadList=files.find(f=>f.path==='depot/gta.dat');if(!loadList)throw new Error('Missing original world load list.');
 const iplLoadList=readWorldIplLoadList(await loadList.file.text()),activeIpls=new Set(iplLoadList);
 const activeFiles=files.filter(f=>!f.path.toLowerCase().endsWith('.ipl')||activeIpls.has(f.path.slice(6).toLowerCase()));
 const [planner,carGenerators]=await Promise.all([prepareWorldFolder(activeFiles),readWorldCarGenerators(source.file,source.entries,activeFiles.filter(f=>f.path.endsWith('.ipl')).map(f=>({...f,path:f.path.replace(/^depot\//,'')})))]);
 const zoneRecords=[];for(const name of ['map.zon','info.zon']){const file=files.find(f=>f.path===`depot/zones/${name}`)?.file;if(!file)throw new Error(`Missing native zone resource: ${name}`);zoneRecords.push(...readZones(await file.text(),name));}
 const worldZones=prepareWorldZones(zoneRecords),script=files.find(f=>f.path==='depot/scripts/main.scm')?.file;if(!script)throw new Error('Missing native initialization script.');
 const scriptBytes=new Uint8Array(await script.arrayBuffer()),zoneInitialization=readInitialZonePopulation(scriptBytes,worldZones);worldZones.population=zoneInitialization.population;
 const ideRecords=(await Promise.all(files.filter(f=>/^depot\/(ide\/.*|data\/default)\.ide$/i.test(f.path)).map(async f=>readIdeAssociations(await f.file.text())))).flat();
 const pickups=readInitialPickups(scriptBytes,ideRecords).pickups,stuntJumps=readInitialStuntJumps(scriptBytes),savePoints=readInitialSavePoints(scriptBytes),radarBlips=readInitialRadarBlips(scriptBytes),restartPoints=readInitialRestartPoints(scriptBytes);
 const iplBytes=new Map(await Promise.all(activeFiles.filter(f=>f.path.toLowerCase().endsWith('.ipl')).map(async f=>[f.path.slice(6).toLowerCase(),new Uint8Array(await f.file.arrayBuffer())] as const)));
 const entryExits={rows:readWorldEntryExits(iplLoadList,iplBytes),script:readInitialEntryExitSwitches(scriptBytes)};
 const tags=readWorldTags(iplLoadList,iplBytes,ideRecords),setPieces=readInitialSetPieces(scriptBytes);
 return {source,planner,carGenerators,worldZones,zoneInitialization,pickups,stuntJumps,savePoints,radarBlips,restartPoints,entryExits,tags,setPieces,geometryCache:new ModelGeometryCache(source.file),modelCache:undefined as ModelReadCache|undefined};
}
export type StaticWorldSource=Awaited<ReturnType<typeof openStaticWorldSource>>;
/** One streamed window: the region's placements with their decoded models, collision, timecycle boxes, car
 * generators and vegetation. A placement whose model is absent from the archive is left out with a notice, as
 * CStreaming renders nothing for a model it cannot load; it never fails the whole window. */
export async function readStaticWorldRegion(world:StaticWorldSource,region:SceneRegion){
 const {source,planner,carGenerators,geometryCache}=world;
 const request=await planner.plan('grove-street',region,true);
 if(!world.modelCache?.matches(source.file,request.textureFiles))world.modelCache=new ModelReadCache(source.file,source.entries,request.textureFiles,geometryCache);
 const modelCache=world.modelCache;
 // Overlap model decoding (8-wide) with collision/vegetation planning.
 const scenePromise=readScene(request,geometryCache,modelCache,8);
 const vegetationPromise=readSceneVegetation(request.environment);
 const loaded=await scenePromise;
 const vegetation=await vegetationPromise;let proceduralAssets;
 if(vegetation){
  const surfaces=new Set(nativeScenePlantEntities(loaded.scene,vegetation.surfaceInfo,vegetation.objects,request.interior).flatMap(entity=>[...entity.collision.mesh.materials]));
  const names=[...new Set(vegetation.proceduralRules.filter(rule=>surfaces.has(rule.surface)).map(rule=>rule.modelName))];
  const collisions=await readSceneCollisionSources(request,source.entries);
  proceduralAssets=await readNativeProcAssets(names,{file:source.file,associations:request.associations,parents:request.parents,collisions:collisions.models!,objects:vegetation.objects});
 }
 return {carGenerators:request.interior===0?carGeneratorsInRegion(carGenerators,region):[],interior:request.interior,parts:loaded.scene,timecycleBoxes:loaded.timecycleBoxes,environment:request.environment,proceduralAssets,
  datasetIdentity:'static-world:'+source.manifest.archive.sha256,preservePosition:true as const,stats:{...source.stats(),geometry:geometryCache.stats(),textures:modelCache.trimDecoded()},sourceDistricts:request.sourceDistricts,
  omitted:loaded.omitted,notices:loaded.notices.filter(n=>n.startsWith('Missing model:')||n.startsWith('Corrupt model:')||n.includes('lack an IDE'))};
}
