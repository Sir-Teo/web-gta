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
 const [planner,carGenerators]=await Promise.all([prepareWorldFolder(files),readWorldCarGenerators(source.file,source.entries,files.filter(f=>f.path.endsWith('.ipl')).map(f=>({...f,path:f.path.replace(/^depot\//,'')})))]);
 return {source,planner,carGenerators};
}
let busy=false;
self.onmessage=async({data})=>{
 try{
  if(data.action==='initialize'){
   if(ready)throw new Error('World source is already initialized.');ready=initialize(data.base);const world=await ready;self.postMessage({type:'ready',carGenerators:world.carGenerators});return;
  }
  if(data.action!=='region'||!ready||busy)throw new Error('Invalid world terrain request.');
  busy=true;const {source,planner,carGenerators}=await ready;
  const request=await planner.plan('grove-street',data.region,true),loaded=await readScene(request);
  if(loaded.omitted)throw new Error(`World region has ${loaded.omitted} unresolved placements.`);
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
