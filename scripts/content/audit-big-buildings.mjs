/** Inspect the native LinkLods/SetupBigBuilding rule against unmodified content.
 * node scripts/content/audit-big-buildings.mjs /absolute/depot /absolute/report.json [lod-multiplier]
 * Read-only source audit. Does not repair IPLs or change runtime collision. */
import {openAsBlob} from 'node:fs';
import {readFile,writeFile,mkdtemp,rm,readdir} from 'node:fs/promises';
import {resolve,join,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {build} from 'rolldown';

const [depotArg,reportArg,multiplierArg='1']=process.argv.slice(2);
if(!depotArg||!reportArg)throw new Error('Usage: audit-big-buildings.mjs DEPOT REPORT [LOD_MULTIPLIER]');
const multiplier=Number(multiplierArg);
if(!Number.isFinite(multiplier)||multiplier<=0)throw new Error('LOD multiplier must be finite and positive.');
const depot=resolve(depotArg),output=resolve(reportArg);
const manifest=JSON.parse(await readFile(join(depot,'scenes.json'),'utf8')).sa;
const files=[];
const archive=await openAsBlob(join(depot,'gta3.img'));Object.defineProperty(archive,'name',{value:'gta3.img'});
files.push({path:'depot/gta3.img',file:archive});
for(const kind of ['ide','ipl'])for(const path of manifest.paths[kind]){
 const relative=`${kind}/${path}.${kind}`;
 files.push({path:`depot/${relative}`,file:new File([await readFile(join(depot,relative))],basename(relative))});
}
let supplemental=[];
try{supplemental=await readdir(join(depot,'supplemental'));}catch(error){if(error.code!=='ENOENT')throw error;}
for(const name of supplemental.filter(name=>/\.(dff|txd|col)$/i.test(name))){
 const file=await openAsBlob(join(depot,'supplemental',name));Object.defineProperty(file,'name',{value:name});
 files.push({path:`depot/supplemental/${name}`,file});
}
const temp=await mkdtemp(join(tmpdir(),'web-gta-big-buildings-'));
try{
 const modules={worldRegions:['WORLD_REGIONS'],worldFolder:['prepareWorldFolder'],scene:['readScene'],sceneCollision:['planSceneCollision']};
 await writeFile(join(temp,'entry.ts'),Object.entries(modules).map(([name,exports])=>`export {${exports.join(',')}} from ${JSON.stringify(resolve('src/assets',name+'.ts'))};`).join('\n'));
 await build({input:join(temp,'entry.ts'),platform:'node',output:{file:join(temp,'readers.mjs'),format:'esm'}});
 const {WORLD_REGIONS,prepareWorldFolder,readScene,planSceneCollision}=await import(pathToFileURL(join(temp,'readers.mjs')));
 const folder=await prepareWorldFolder(files),regions=[];
 for(const region of WORLD_REGIONS){
  const loaded=await readScene(await folder.plan(region.id));
  const plan=planSceneCollision(loaded.scene),additional=[],remainingMissing=new Set();
  loaded.scene.forEach((part,index)=>{
   // Linked LOD targets are already excluded by the current collision planner.
   for(const placementIndex of plan.indices[index]){
    const drawDistance=part.definition?.drawDistance;
    if(drawDistance!==undefined&&drawDistance*multiplier>300){
     additional.push({model:part.name,modelId:part.definition.id,drawDistance,hasNativeCollision:!!part.collision,
      source:part.sourceRefs?.[placementIndex],placement:part.placements[placementIndex]});
    }else if(!part.collision)remainingMissing.add(part.name);
   }
  });
  const record={id:region.id,placements:loaded.requested,omitted:loaded.omitted,
   currentPhysicalPlacements:plan.indices.reduce((n,indices)=>n+indices.length,0),
   currentMissing:plan.missing,additionalBigBuildings:additional,
   proposedPhysicalPlacements:plan.indices.reduce((n,indices)=>n+indices.length,0)-additional.length,
   proposedMissing:[...remainingMissing]};
  regions.push(record);
  console.log(`${region.id}: ${additional.length} additional non-colliding placements; missing ${record.currentMissing.length} -> ${record.proposedMissing.length}`);
 }
 const revision='0076f9017b4aeef7433957ac2bd8b6988e9df166';
 await writeFile(output,JSON.stringify({checkedAt:new Date().toISOString(),depot,lodMultiplier:multiplier,
  rule:'LinkLods: LOD children > 0 OR camera LOD multiplier * IDE draw distance > 300; SetupBigBuilding disables collision.',
  sourceRevision:revision,sourceFiles:['FileLoader.cpp','Entity/Entity.cpp','Camera.h'].map(path=>`https://github.com/gta-reversed/gta-reversed/blob/${revision}/source/game_sa/${path}`),
  scope:'Comparison with current browser planner; no native cache replay, retail execution, source edits or runtime changes.',regions},null,2));
 console.log(output);
 if(regions.some(region=>region.omitted))process.exitCode=1;
}finally{await rm(temp,{recursive:true,force:true});}
