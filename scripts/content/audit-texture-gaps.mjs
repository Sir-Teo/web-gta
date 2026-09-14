/** Audit the actual faces affected by missing map textures and compare a second public pack.
 * node scripts/content/audit-texture-gaps.mjs /absolute/content-directory [--compare-public]
 * Native comparison files remain in the content depot; no replacements are applied. */
import {openAsBlob} from 'node:fs';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'rolldown';
const arg=process.argv[2];
if(!arg)throw new Error('Usage: node scripts/content/audit-texture-gaps.mjs /absolute/content-directory [--compare-public]');
const depot=resolve(arg),compare=process.argv.includes('--compare-public');
const audit=JSON.parse(await readFile(join(depot,'world-content.json'),'utf8'));
const models=new Map();
for(const region of audit.regions)for(const model of region.content??[]){
 const missing=model.notices.filter(n=>n.startsWith('Unbound textures: ')).flatMap(n=>n.slice(18).split(', '));
 if(missing.length)models.set(model.model,{model:model.model,dictionary:model.dictionary,missing});
}
const temp=await mkdtemp(join(tmpdir(),'web-gta-texture-gaps-'));
const hash=b=>createHash('sha256').update(b).digest('hex');
try{
 await writeFile(join(temp,'entry.ts'),['img','dff','txd','ide'].map(m=>`export * from ${JSON.stringify(resolve('src/assets',m+'.ts'))};`).join('\n'));
 await build({input:join(temp,'entry.ts'),platform:'node',output:{file:join(temp,'readers.mjs'),format:'esm'}});
 const {readImgIndex,readImgEntry,readDff,readTxd,decodeTexture,readIdeParents,textureDictionaryChain}=await import(pathToFileURL(join(temp,'readers.mjs')));
 const parentSources=[];const parents=new Map();
 for(const resource of audit.resources.filter(r=>r.path.toLowerCase().endsWith('.ide'))){
  const bytes=await readFile(resource.path),definitions=readIdeParents(bytes.toString());
  if(!definitions.length)continue;
  parentSources.push({path:resource.path,url:resource.url,sha256:hash(bytes),definitions});
  for(const [child,parent] of definitions){
   if(parents.has(child)&&parents.get(child)!==parent)throw new Error(`Conflicting texture parent for ${child}`);
   parents.set(child,parent);
  }
 }
 const archive=await openAsBlob(join(depot,'gta3.img')),entries=await readImgIndex(archive),byName=new Map(entries.map(e=>[e.name.toLowerCase(),e]));
 const read=async name=>{const entry=byName.get(name.toLowerCase());if(!entry)throw new Error(`Missing archive entry ${name}`);return readImgEntry(archive,entry);};
 const report={checkedAt:new Date().toISOString(),archive:join(depot,'gta3.img'),parentSources,models:[],publicComparisons:[],candidateScan:{dictionaries:0,errors:[],matches:[]}};
 const wanted=new Set([...models.values()].flatMap(m=>m.missing.map(n=>n.toLowerCase())));
 for(const entry of entries.filter(e=>e.name.toLowerCase().endsWith('.txd'))){
  report.candidateScan.dictionaries++;
  const bytes=await readImgEntry(archive,entry),raw=Buffer.from(bytes).toString('latin1').toLowerCase();
  if(![...wanted].some(name=>raw.includes(name)))continue;
  try{for(const t of readTxd(bytes))if(wanted.has(t.name.toLowerCase())){
   const mips=t.mips.map((m,level)=>({width:m.width,height:m.height,rgbaSha256:hash(decodeTexture(t,level)),reconstructed:m.bytes.length===0}));
   // Include dimensions and every decoded mip; a name or base-image match alone
   // does not establish the same distant appearance or sampling behavior.
   const pixelSha256=hash(JSON.stringify(mips.map(({width,height,rgbaSha256})=>({width,height,rgbaSha256}))));
   const appearanceSha256=hash(JSON.stringify({pixelSha256,filter:t.filter,addressU:t.addressU,addressV:t.addressV,hasAlpha:t.hasAlpha}));
   report.candidateScan.matches.push({dictionary:entry.name,dictionarySha256:hash(bytes),name:t.name,width:t.width,height:t.height,filter:t.filter,addressU:t.addressU,addressV:t.addressV,hasAlpha:t.hasAlpha,mips,pixelSha256,appearanceSha256});
  }}
  catch(error){report.candidateScan.errors.push({dictionary:entry.name,error:error.message});}
 }
 const compared=new Set();
 for(const info of models.values()){
  const dff=await read(info.model+'.dff'),txd=await read(info.dictionary+'.txd'),model=readDff(dff),rasters=readTxd(txd);
  const affected=[];
  model.geometries.forEach((g,geometry)=>g.materials.forEach((m,material)=>{
   if(!info.missing.some(n=>n.toLowerCase()===m.texture.toLowerCase()))return;
   affected.push({texture:m.texture,geometry,material,triangles:[...g.materialIds].filter(id=>id===material).length,atomicReferences:model.atomics.filter(a=>a.geometry===geometry).map(a=>({frame:a.frame,flags:a.flags}))});
  }));
  const dictionaryChain=textureDictionaryChain(info.dictionary.toLowerCase(),parents).map(name=>name+'.txd');
  const resolution=info.missing.map(texture=>{
   const candidates=report.candidateScan.matches.filter(c=>c.name.toLowerCase()===texture.toLowerCase());
   const eligible=candidates.filter(c=>dictionaryChain.includes(c.dictionary.toLowerCase()));
   return {texture,candidateCount:candidates.length,pixelVariants:new Set(candidates.map(c=>c.pixelSha256)).size,appearanceVariants:new Set(candidates.map(c=>c.appearanceSha256)).size,eligibleDictionaries:eligible.map(c=>c.dictionary),status:eligible.length?'declared-chain-candidate':candidates.length?'outside-declared-chain':'absent-from-archive'};
  });
  report.models.push({...info,dffSha256:hash(dff),txdSha256:hash(txd),dictionaryChain,resolution,dictionaryRasters:rasters.map(t=>t.name),affected});
  if(!compare)continue;
  for(const [name,original] of [[info.model+'.dff',dff],[info.dictionary+'.txd',txd]]){
   if(compared.has(name))continue;compared.add(name);
   const url='https://gtastuff.com/api/file?name='+encodeURIComponent(name.toLowerCase()),response=await fetch(url);
   if(!response.ok){report.publicComparisons.push({name,url,status:response.status});continue;}
   const bytes=new Uint8Array(await response.arrayBuffer());
   if(name.endsWith('.dff'))readDff(bytes);else readTxd(bytes);
   const dir=join(depot,'comparison','gtastuff');await mkdir(dir,{recursive:true});await writeFile(join(dir,name),bytes);
   report.publicComparisons.push({name,url,status:response.status,bytes:bytes.length,sha256:hash(bytes),archiveSha256:hash(original),identicalToArchive:hash(bytes)===hash(original)});
  }
 }
 const output=join(depot,compare?'texture-gaps-public.json':'texture-gaps.json');await writeFile(output,JSON.stringify(report,null,2));
 console.log(`${report.models.length} affected models; ${report.candidateScan.dictionaries} dictionaries scanned; ${report.candidateScan.matches.length} exact-name candidate rasters; ${report.candidateScan.errors.length} candidate parse errors.`);
 if(compare)console.log(`${report.publicComparisons.filter(p=>p.identicalToArchive).length}/${report.publicComparisons.length} public comparison files are byte-identical to the archive.`);
 console.log(output);
}finally{await rm(temp,{recursive:true,force:true});}
