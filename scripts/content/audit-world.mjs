/** Acquire public map metadata and audit native world content using the game's readers.
 * node scripts/content/audit-world.mjs /absolute/gta3.img /absolute/content-directory
 * Native files stay in the supplied directory; only code/reports belong in the repository. */
import {openAsBlob,constants} from 'node:fs';
import {readFile,writeFile,mkdir,copyFile,mkdtemp,rm,readdir} from 'node:fs/promises';
import {resolve,basename,join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'rolldown';
const [archiveArg,outputArg]=process.argv.slice(2);
if(!archiveArg||!outputArg)throw new Error('Usage: node scripts/content/audit-world.mjs /absolute/gta3.img /absolute/content-directory');
const output=resolve(outputArg),archive=resolve(archiveArg),base='https://z.noclip.website/GrandTheftAutoSanAndreas/';
const manifestUrl='https://raw.githubusercontent.com/magcius/noclip.website/75086f2350cb6f320023931d6d73f20f5c6bbc32/src/GrandTheftAuto3/scenes.json';
await mkdir(output,{recursive:true});
let previous=[];try{previous=JSON.parse(await readFile(join(output,'world-content.json'),'utf8')).resources;}catch(error){if(error.code!=='ENOENT')throw error;}
const resources=[],hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function acquire(url,path){
 const cached=previous.find(r=>r.url===url&&r.path===path);if(cached){try{const bytes=await readFile(path);if(hash(bytes)===cached.sha256){resources.push(cached);return bytes;}}catch(error){if(error.code!=='ENOENT')throw error;}}
 const response=await fetch(url);if(!response.ok)throw new Error(`${response.status}: ${url}`);
 const bytes=Buffer.from(await response.arrayBuffer());await mkdir(resolve(path,'..'),{recursive:true});await writeFile(path,bytes);
 resources.push({url,path,bytes:bytes.length,sha256:hash(bytes)});return bytes;
}
const manifest=JSON.parse(await acquire(manifestUrl,join(output,'scenes.json'))).sa;
for(const kind of ['ide','ipl']){
 const paths=manifest.paths[kind];
 for(let i=0;i<paths.length;i+=4)await Promise.all(paths.slice(i,i+4).map(p=>acquire(`${base}data/maps/${p}.${kind}`,join(output,kind,`${p}.${kind}`))));
 console.log(`Acquired ${paths.length} ${kind.toUpperCase()} files`);
}
await acquire(base+manifest.paths.dat.water,join(output,'water.dat'));
await acquire(base+'models/particle.txd',join(output,'particle.txd'));
await acquire(base+manifest.paths.dat.timecyc,join(output,'timecycp.dat'));
const localArchive=join(output,'gta3.img');if(archive!==localArchive)await copyFile(archive,localArchive,constants.COPYFILE_FICLONE);
const temp=await mkdtemp(join(tmpdir(),'web-gta-content-'));
try{
 const modules={worldRegions:['WORLD_REGIONS'],img:['readImgIndex','readImgEntry'],ipl:['readIpl'],ide:['readIdeAssociations'],worldFolder:['planWorldFolder'],scene:['readScene'],sceneCollision:['planSceneCollision']};
 await writeFile(join(temp,'entry.ts'),Object.entries(modules).map(([name,exports])=>`export {${exports.join(',')}} from ${JSON.stringify(resolve('src/assets',name+'.ts'))};`).join('\n'));
 await build({input:join(temp,'entry.ts'),platform:'node',output:{file:join(temp,'readers.mjs'),format:'esm'}});
 const readers=await import(pathToFileURL(join(temp,'readers.mjs'))),file=await openAsBlob(localArchive);Object.defineProperty(file,'name',{value:'gta3.img'});
 const entries=await readers.readImgIndex(file),names=new Set(entries.map(e=>e.name.toLowerCase()));
 const associations=[],definitionSources=[];
 for(const p of manifest.paths.ide){const text=await readFile(join(output,'ide',p+'.ide'),'utf8');const records=readers.readIdeAssociations(text);associations.push(...records);definitionSources.push({path:p,records});}
 const scopedOnly=p=>definitionSources.filter(s=>s.path.startsWith(p.split('/')[0]+'/')||s.path.startsWith('generic/')||['interior/propext','leveldes/levelmap','leveldes/seabed'].includes(s.path)).flatMap(s=>s.records);
 const allById=new Map();for(const a of associations){if(!allById.has(a.id))allById.set(a.id,new Map());allById.get(a.id).set(a.model.toLowerCase(),a);}
 const scopedDefinitions=p=>{const records=scopedOnly(p),ids=new Set(records.map(a=>a.id));return [...records,...[...allById].filter(([id,models])=>!ids.has(id)&&models.size===1).map(([,models])=>[...models.values()][0])];};
 const districts=[];
 for(const p of manifest.paths.ipl){
  const path=join(output,'ipl',p+'.ipl'),staticBytes=await readFile(path),stat=readers.readIpl(staticBytes),stem=basename(p).toLowerCase();
  const streams=entries.filter(e=>e.name.toLowerCase().startsWith(stem+'_stream')&&e.name.toLowerCase().endsWith('.ipl'));
  const byId=new Map(scopedDefinitions(p).map(a=>[a.id,a]));
  const instances=[...stat.instances];for(const entry of streams)instances.push(...readers.readIpl(await readers.readImgEntry(file,entry)).instances);
  if(!instances.length)continue;
  const missingIds=new Set(),models=new Set(),missingDff=new Set(),missingTxd=new Set();
  for(const instance of instances){const def=byId.get(instance.modelId),name=instance.modelName??def?.model;if(!name){missingIds.add(instance.modelId);continue;}models.add(name);if(!names.has(name.toLowerCase()+'.dff'))missingDff.add(name);if(def&&!names.has(def.dictionary.toLowerCase()+'.txd'))missingTxd.add(def.dictionary);}
  const exterior=instances.filter(i=>i.interior===0),bounds=exterior.length?{min:[0,1,2].map(axis=>Math.min(...exterior.map(i=>i.position[axis]))),max:[0,1,2].map(axis=>Math.max(...exterior.map(i=>i.position[axis])))}:null;
  districts.push({regionCounts:readers.WORLD_REGIONS.map(({id,x,y,radius})=>({id,placements:exterior.filter(i=>Math.hypot(i.position[0]-x,i.position[1]-y)<=radius).length})),district:p,staticFile:path,timecycleBoxes:stat.timecycleBoxes,streams:streams.map(e=>e.name),placements:instances.length,exterior:exterior.length,models:models.size,bounds,missingIds:[...missingIds],missingDff:[...missingDff],missingTxd:[...missingTxd]});
 }
 const regions=[];
 // Use the same file planner as the browser: IDE conflicts, stream matching,
 // shared metadata scope and required paths must have identical semantics.
 const folderFiles=[{path:'depot/gta3.img',file}];
 for(const kind of ['ide','ipl'])for(const p of manifest.paths[kind]){
  const relative=`${kind}/${p}.${kind}`;
  folderFiles.push({path:`depot/${relative}`,file:new File([await readFile(join(output,relative))],basename(relative))});
 }
 const supplementalFiles=[];
 let supplementalNames=[];try{supplementalNames=await readdir(join(output,'supplemental'));}catch(error){if(error.code!=='ENOENT')throw error;}
 for(const name of supplementalNames.filter(name=>/\.(dff|txd|col)$/i.test(name))){
  const path=join(output,'supplemental',name),file=await openAsBlob(path);Object.defineProperty(file,'name',{value:name});
  if(file.size>64*1024*1024||supplementalFiles.length>=256)throw new Error('Supplemental content exceeds audit limits.');
  folderFiles.push({path:`depot/supplemental/${name}`,file});
  supplementalFiles.push({path,bytes:file.size,sha256:hash(new Uint8Array(await file.arrayBuffer()))});
 }
 for(const candidate of readers.WORLD_REGIONS){
  try{
   const region={x:candidate.x,y:candidate.y,radius:candidate.radius,includeCollisionBounds:process.argv.includes('--collision-bounds')||!!candidate.includeCollisionBounds};
   const request=await readers.planWorldFolder(folderFiles,candidate.id);
   const scene=await readers.readScene({...request,region});
   const collision=readers.planSceneCollision(scene.scene);
   regions.push({...candidate,planner:'browser-folder',selection:region.includeCollisionBounds?'origins-and-collision-bounds':'origins',timecycleBoxes:scene.timecycleBoxes,requested:scene.requested,omitted:scene.omitted,models:scene.scene.length,missingCollision:collision.missing,notices:scene.notices,content:scene.scene.map(p=>({model:p.name,dictionary:p.definition?.dictionary,placements:p.placements.length,triangles:p.model.geometries.reduce((n,g)=>n+g.indices.length/3,0),textures:p.textures.map(t=>t.name),notices:p.notices,collision:!!p.collision}))});
   console.log(`${candidate.name}: ${scene.scene.length} models, ${scene.requested} placements, ${scene.omitted} omitted`);
  }catch(error){regions.push({...candidate,planner:'browser-folder',error:error.stack});console.log(`${candidate.name}: ${error.message}`);}
 }
 const report={selection:process.argv.includes('--collision-bounds')?'origins-and-collision-bounds':'preset-defaults',checkedAt:new Date().toISOString(),archive:{path:localArchive,bytes:file.size,entries:entries.length,counts:Object.fromEntries(['dff','txd','col','ipl'].map(ext=>[ext,entries.filter(e=>e.name.toLowerCase().endsWith('.'+ext)).length]))},resources,supplementalFiles,districts,regions};
 await writeFile(join(output,process.argv.includes('--collision-bounds')?'world-content-bounds.json':'world-content.json'),JSON.stringify(report,null,2));
 await writeFile(join(output,'timecycle-boxes.json'),JSON.stringify(districts.flatMap(d=>d.timecycleBoxes.map(box=>({source:d.staticFile,...box}))),null,2));
 console.log(`Content report: ${join(output,process.argv.includes('--collision-bounds')?'world-content-bounds.json':'world-content.json')}`);
 if(regions.some(region=>region.error))process.exitCode=1;
}finally{await rm(temp,{recursive:true,force:true});}
