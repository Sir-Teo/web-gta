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
import {readNativeProcAssets} from './nativeProcAssets';
let ready:ReturnType<typeof initialize>|undefined;
async function initialize(base:string){
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
 return {source,planner,carGenerators,worldZones,zoneInitialization,pickups,stuntJumps,savePoints,radarBlips,restartPoints,entryExits,geometryCache:new ModelGeometryCache(source.file)};
}
let busy=false;
let modelCache:ModelReadCache|undefined;
/** Coalesce overlapping follow requests instead of failing: only the latest
 * region matters for streaming (CStreaming-style: camera position wins). */
let queued:{id:number;region:any}|undefined;
self.onmessage=async({data})=>{
 let activeId:number|undefined=data?.id;
 try{
   if(data.action==='initialize'){
    if(ready)throw new Error('World source is already initialized.');ready=initialize(data.base);const world=await ready;self.postMessage({type:'ready',carGenerators:world.carGenerators,pickups:world.pickups,stuntJumps:world.stuntJumps,savePoints:world.savePoints,radarBlips:world.radarBlips,restartPoints:world.restartPoints,entryExits:{...world.entryExits,archives:world.source.archives},worldZones:world.worldZones,zoneInitialization:{...world.zoneInitialization,population:undefined}});return;
   }
   if(data.action!=='region'||!ready){throw new Error('Invalid world terrain request.');}
   if(busy){queued={id:data.id,region:data.region};return;}
   activeId=data.id;
   let activeRegion:any=data.region;
   busy=true;
   try{
   for(;;){
   if(queued!==undefined){activeId=queued.id;activeRegion=queued.region;queued=undefined;}
   const current={id:activeId,region:activeRegion};
   const {source,planner,carGenerators,geometryCache}=await ready!;
   const request=await planner.plan('grove-street',current.region,true);
   if(!modelCache?.matches(source.file,request.textureFiles))modelCache=new ModelReadCache(source.file,source.entries,request.textureFiles,geometryCache);
   // Overlap model decoding (8-wide) with collision/vegetation planning.
   const scenePromise=readScene(request,geometryCache,modelCache,8);
   const vegetationPromise=readSceneVegetation(request.environment);
   const loaded=await scenePromise;
   if(loaded.omitted)throw new Error(`World region has ${loaded.omitted} unresolved placements: ${loaded.notices.filter(n=>n.startsWith("Missing model:")||n.includes("lack an IDE")).join(" ")}`);
   const vegetation=await vegetationPromise;let proceduralAssets;
   if(vegetation){
    const surfaces=new Set(nativeScenePlantEntities(loaded.scene,vegetation.surfaceInfo,vegetation.objects,request.interior).flatMap(entity=>[...entity.collision.mesh.materials]));
    const names=[...new Set(vegetation.proceduralRules.filter(rule=>surfaces.has(rule.surface)).map(rule=>rule.modelName))];
    const collisions=await readSceneCollisionSources(request,source.entries);
    proceduralAssets=await readNativeProcAssets(names,{file:source.file,associations:request.associations,parents:request.parents,collisions:collisions.models!,objects:vegetation.objects});
   }
   self.postMessage({type:'terrain',followId:current.id,carGenerators:request.interior===0?carGeneratorsInRegion(carGenerators,current.region):[],interior:request.interior,parts:loaded.scene,timecycleBoxes:loaded.timecycleBoxes,environment:request.environment,proceduralAssets,
    datasetIdentity:'static-world:'+source.manifest.archive.sha256,preservePosition:true,stats:{...source.stats(),geometry:geometryCache.stats(),textures:modelCache!.trimDecoded()},sourceDistricts:request.sourceDistricts});
   if(!queued)break;
   // A newer follow request arrived while decoding: load the latest next.
   continue;
   }
   }finally{busy=false;}
  }catch(error){
    const pendingQueued=queued;queued=undefined;
    self.postMessage({type:'error',followId:activeId,message:error instanceof Error?error.message:'World streaming failed.'});
    if(pendingQueued)self.postMessage({type:'error',followId:pendingQueued.id,message:'Superseded by a newer terrain request.'});
  }
};
