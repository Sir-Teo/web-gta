/** Classify unresolved bindings from a fresh audit-world report using native
 * models/dictionaries. No replacement assets, fallback binding or network I/O. */
import {openAsBlob} from 'node:fs';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'rolldown';
const [input,...extra]=process.argv.slice(2);if(!input||extra.length)throw new Error('Usage: node scripts/content/audit-texture-bindings.mjs /absolute/content-depot');
const depot=resolve(input),temp=await mkdtemp(join(tmpdir(),'web-gta-texture-bindings-'));
try{
 const modules=['img','txd','ide','readModel'];
 await writeFile(join(temp,'entry.ts'),modules.map(name=>`export * from ${JSON.stringify(resolve('src/assets',name+'.ts'))};`).join('\n'));
 await build({input:join(temp,'entry.ts'),platform:'node',output:{file:join(temp,'readers.mjs'),format:'esm'}});
 const readers=await import(pathToFileURL(join(temp,'readers.mjs'))),world=JSON.parse(await readFile(join(depot,'world-content.json'),'utf8'));
 if(world.regions.some(region=>region.error))throw new Error('Resolve failed regions in audit-world before auditing their texture bindings.');
 const file=await openAsBlob(join(depot,'gta3.img'));Object.defineProperty(file,'name',{value:'gta3.img'});
 const entries=await readers.readImgIndex(file),byName=new Map(entries.map(entry=>[entry.name.toLowerCase(),entry]));
 const manifest=JSON.parse(await readFile(join(depot,'scenes.json'),'utf8')).sa,parentRecords=[];
 for(const path of manifest.paths.ide)parentRecords.push(...readers.readIdeParents(new TextDecoder('windows-1252').decode(await readFile(join(depot,'ide',path+'.ide')))));
 const parents=readers.mergeIdeParents(parentRecords),cases=new Map();
 for(const region of world.regions)for(const model of region.content??[])if(model.notices.some(note=>note.startsWith('Unbound textures:'))){
  const key=`${model.model.toLowerCase()}:${model.dictionary?.toLowerCase()}`;
  if(!cases.has(key))cases.set(key,{model:model.model,dictionary:model.dictionary,regions:[]});cases.get(key).regions.push(region.id);
 }
 const bindings=[],needed=new Set();
 for(const item of cases.values()){
  const entry=byName.get(item.model.toLowerCase()+'.dff'),textureEntry=byName.get(item.dictionary?.toLowerCase()+'.txd');
  if(!entry||!textureEntry)throw new Error(`Archive model/dictionary unavailable for ${item.model}; this audit requires native archived sources.`);
  const result=await readers.readModel({file,entry,textureEntry,parents:[...parents]});
  const found=new Set(result.textures.map(texture=>texture.name.toLowerCase()));
  const names=new Set(result.model.geometries.filter(g=>g.uvs.length).flatMap(g=>g.materials.map(m=>m.texture).filter(Boolean)));
  for(const texture of names)if(!found.has(texture.toLowerCase())){
   needed.add(texture.toLowerCase());bindings.push({...item,texture,loadedChain:result.dictionaryNames,candidates:[]});
  }
 }
 const scanErrors=[],matches=new Map([...needed].map(name=>[name,[]]));let dictionariesScanned=0;
 for(const entry of entries.filter(entry=>/\.txd$/i.test(entry.name))){
  const bytes=await readers.readImgEntry(file,entry);dictionariesScanned++;
  // An absent byte string rules out a native texture name without needing to
  // decode unrelated dictionaries. Positive hits still require proper parsing.
  const raw=Buffer.from(bytes).toString('latin1').toLowerCase();
  const hits=[...needed].filter(name=>raw.includes(name));if(!hits.length)continue;
  try{
   for(const texture of readers.readTxd(bytes))if(needed.has(texture.name.toLowerCase()))matches.get(texture.name.toLowerCase()).push({dictionary:entry.name,texture:texture.name,width:texture.width,height:texture.height,format:texture.format,mipLevels:texture.mips.length,archiveEntrySha256:createHash('sha256').update(bytes).digest('hex')});
  }catch(error){scanErrors.push({dictionary:entry.name,names:hits,error:error.message});}
 }
 for(const binding of bindings){
  binding.candidates=matches.get(binding.texture.toLowerCase());
  binding.classification=scanErrors.some(error=>error.names.includes(binding.texture.toLowerCase()))?'incomplete-scan':binding.candidates.length?'outside-loaded-chain':'absent-from-world-archive';
 }
 const report={archive:join(depot,'gta3.img'),contentReport:join(depot,'world-content.json'),dictionariesScanned,scanErrors,bindings};
 await writeFile(join(depot,'texture-bindings.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,bindings:bindings.map(({candidates,...binding})=>({...binding,candidateDictionaries:candidates.length}))},null,2));
 if(scanErrors.length)process.exitCode=1;
}finally{await rm(temp,{recursive:true,force:true});}
