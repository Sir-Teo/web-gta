import {readWorldIplLoadList} from './worldLoadList';
import {readInitialZonePopulation} from './scmZonePopulation';
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
 const activeIpls=new Set(readWorldIplLoadList(await loadList.file.text()));
 const activeFiles=files.filter(f=>!f.path.toLowerCase().endsWith('.ipl')||activeIpls.has(f.path.slice(6).toLowerCase()));
 const [planner,carGenerators]=await Promise.all([prepareWorldFolder(activeFiles),readWorldCarGenerators(source.file,source.entries,activeFiles.filter(f=>f.path.endsWith('.ipl')).map(f=>({...f,path:f.path.replace(/^depot\//,'')})))]);
 const zoneRecords=[];for(const name of ['map.zon','info.zon']){const file=files.find(f=>f.path===`depot/zones/${name}`)?.file;if(!file)throw new Error(`Missing native zone resource: ${name}`);zoneRecords.push(...readZones(await file.text(),name));}
 const worldZones=prepareWorldZones(zoneRecords),script=files.find(f=>f.path==='depot/scripts/main.scm')?.file;if(!script)throw new Error('Missing native initialization script.');
 const zoneInitialization=readInitialZonePopulation(new Uint8Array(await script.arrayBuffer()),worldZones);worldZones.population=zoneInitialization.population;
 return {source,planner,carGenerators,worldZones,zoneInitialization};
}
let busy=false;
self.onmessage=async({data})=>{
 try{
  if(data.action==='initialize'){
   if(ready)throw new Error('World source is already initialized.');ready=initialize(data.base);const world=await ready;self.postMessage({type:'ready',carGenerators:world.carGenerators,worldZones:world.worldZones,zoneInitialization:{...world.zoneInitialization,population:undefined}});return;
  }
  if(data.action!=='region'||!ready||busy)throw new Error('Invalid world terrain request.');
  busy=true;const {source,planner,carGenerators}=await ready;
  const request=await planner.plan('grove-street',data.region,true),loaded=await readScene(request);
  if(loaded.omitted)throw new Error(`World region has ${loaded.omitted} unresolved placements: ${loaded.notices.filter(n=>n.startsWith("Missing model:")||n.includes("lack an IDE")).join(" ")}`);
  const vegetation=await readSceneVegetation(request.environment);let proceduralAssets;
  if(vegetation){
   const surfaces=new Set(nativeScenePlantEntities(loaded.scene,vegetation.surfaceInfo,vegetation.objects,0).flatMap(entity=>[...entity.collision.mesh.materials]));
   const names=[...new Set(vegetation.proceduralRules.filter(rule=>surfaces.has(rule.surface)).map(rule=>rule.modelName))];
   const collisions=await readSceneCollisionSources(request,source.entries);
   proceduralAssets=await readNativeProcAssets(names,{file:source.file,associations:request.associations,parents:request.parents,collisions:collisions.models!,objects:vegetation.objects});
  }
  self.postMessage({type:'terrain',followId:data.id,carGenerators:carGeneratorsInRegion(carGenerators,data.region),parts:loaded.scene,timecycleBoxes:loaded.timecycleBoxes,environment:request.environment,proceduralAssets,
   datasetIdentity:'static-world:'+source.manifest.archive.sha256,preservePosition:true,stats:source.stats(),sourceDistricts:request.sourceDistricts});
 }catch(error){self.postMessage({type:'error',followId:data.id,message:error instanceof Error?error.message:'World streaming failed.'});}
 finally{if(data.action==='region')busy=false;}
};
