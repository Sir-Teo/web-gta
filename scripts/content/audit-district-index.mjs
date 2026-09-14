/** Local-only district coverage audit; uses the acquired manifest and native readers. */
import {openAsBlob} from 'node:fs';
import {readFile,writeFile,mkdtemp,rm,readdir} from 'node:fs/promises';
import {resolve,join,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {build} from 'rolldown';
const [input,...extra]=process.argv.slice(2);if(!input||extra.length)throw new Error('Usage: node scripts/content/audit-district-index.mjs /absolute/content-depot');
const depot=resolve(input),temp=await mkdtemp(join(tmpdir(),'web-gta-district-index-'));
try{
 const modules=['districtIndex','img','ipl','ide','relatedIpls','sceneCollisionSources','sceneRegion','worldRegions'];
 await writeFile(join(temp,'entry.ts'),modules.map(name=>`export * from ${JSON.stringify(resolve('src/assets',name+'.ts'))};`).join('\n'));
 await build({input:join(temp,'entry.ts'),platform:'node',output:{file:join(temp,'readers.mjs'),format:'esm'}});
 const readers=await import(pathToFileURL(join(temp,'readers.mjs')));
 const file=await openAsBlob(join(depot,'gta3.img'));Object.defineProperty(file,'name',{value:'gta3.img'});
 const entries=await readers.readImgIndex(file),archiveNames=new Set(entries.map(e=>e.name.toLowerCase()));
 const manifest=JSON.parse(await readFile(join(depot,'scenes.json'),'utf8')).sa;
 const definitions=[];
 for(const path of manifest.paths.ide)definitions.push({path,records:readers.readIdeAssociations(new TextDecoder('windows-1252').decode(await readFile(join(depot,'ide',path+'.ide'))))});
 const additionalCollisionFiles=[];
 let supplements=[];try{supplements=await readdir(join(depot,'supplemental'));}catch(error){if(error.code!=='ENOENT')throw error;}
 for(const name of supplements.filter(name=>/\.col$/i.test(name)&&!archiveNames.has(name.toLowerCase()))){const blob=await openAsBlob(join(depot,'supplemental',name));Object.defineProperty(blob,'name',{value:name});additionalCollisionFiles.push(blob);}
 const collisions=await readers.readSceneCollisionSources({file,allArchiveCollisions:true,additionalCollisionFiles},entries),byModel=new Map(collisions.models.map(model=>[model.name.toLowerCase(),model]));
 const sources=[],sourceStats=[];
 for(const id of manifest.paths.ipl){
  const own=definitions.filter(source=>source.path.startsWith(id.split('/')[0]+'/')||source.path.startsWith('generic/')||['interior/propext','leveldes/levelmap','leveldes/seabed'].includes(source.path));
  const variants=new Map();
  for(const definition of own.flatMap(source=>source.records)){if(!variants.has(definition.id))variants.set(definition.id,new Set());variants.get(definition.id).add(definition.model.toLowerCase());}
  // Unambiguous shared definitions may be used outside their owning folder.
  const global=new Map();for(const definition of definitions.flatMap(source=>source.records)){if(!global.has(definition.id))global.set(definition.id,new Set());global.get(definition.id).add(definition.model.toLowerCase());}
  for(const [id,names] of global)if(!variants.has(id)&&names.size===1)variants.set(id,names);
  const nameFor=p=>p.modelName?.toLowerCase()??(variants.get(p.modelId)?.size===1?[...variants.get(p.modelId)][0]:undefined);
  const placements=readers.readIpl(await readFile(join(depot,'ipl',id+'.ipl'))).instances;
  const streams=readers.relatedIplEntries(basename(id)+'.ipl',entries).map(i=>entries[i]);
  for(const entry of streams)placements.push(...readers.readIpl(await readers.readImgEntry(file,entry)).instances);
  sources.push({id,placements,nameFor,boundsFor:p=>byModel.get(nameFor(p))?.bounds});
  sourceStats.push({id:id.toLowerCase(),streams:streams.length,unresolvedExteriorModelIds:placements.filter(p=>p.interior===0&&!nameFor(p)).length});
 }
 const index=readers.buildDistrictIndex(sources);
 const districts=index.map((district,i)=>({id:district.id,exteriorPlacements:district.exteriorPlacements,collisionBounds:district.collisionBounds,...sourceStats[i]}));
 const regions=readers.WORLD_REGIONS.map(region=>({id:region.id,matches:readers.queryDistrictIndex(index,{...region,includeCollisionBounds:true}),presetSources:[region.district,...region.neighbors??[]].map(id=>id.toLowerCase())}));
 for(const region of regions){
  const selection=readers.WORLD_REGIONS.find(r=>r.id===region.id);
  region.unselectedSources=region.matches.filter(match=>!region.presetSources.includes(match.id)).map(match=>{
   const source=sources.find(source=>source.id.toLowerCase()===match.id);
   const rows=source.placements.map((placement,index)=>({placement,ref:{namespace:'primary',index,format:'text',sourceName:source.id}}));
   const selected=readers.selectSceneRegion(rows,0,{...selection,includeCollisionBounds:true},source.boundsFor);
   return {id:match.id,models:[...new Set(selected.map(source.nameFor))]};
  });
 }
 const report={archive:join(depot,'gta3.img'),districts,regions};
 await writeFile(join(depot,'district-index.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({sources:index.length,exteriorPlacements:index.reduce((n,d)=>n+d.exteriorPlacements,0),collisionBounds:index.reduce((n,d)=>n+d.collisionBounds,0),unresolvedExteriorModelIds:districts.reduce((n,d)=>n+d.unresolvedExteriorModelIds,0),regions},null,2));
}finally{await rm(temp,{recursive:true,force:true});}
