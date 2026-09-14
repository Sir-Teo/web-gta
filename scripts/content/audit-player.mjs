/** Acquire and inspect native player body inputs; no completed CJ mesh is synthesized.
 * node scripts/content/audit-player.mjs /absolute/content-directory */
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';import {tmpdir} from 'node:os';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';import {build} from 'rolldown';
if(!process.argv[2])throw new Error('Usage: node scripts/content/audit-player.mjs /absolute/content-directory');
const dir=resolve(process.argv[2],'player');await mkdir(dir,{recursive:true});
let previous=[];try{previous=JSON.parse(await readFile(join(dir,'sources.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const hash=b=>createHash('sha256').update(b).digest('hex'),sources=[];
const names=['torso','head','legs','feet','vest'].flatMap(n=>[n+'.dff',n+'.txd']).concat('hands.dff','player.dff','player_torso.txd','player_face.txd','player_legs.txd','player_feet.txd');
for(const name of names){
 const url='https://gtastuff.com/api/file?name='+name+'&source='+(name==='player.dff'?'gta3.img':'player.img'),old=previous.find(r=>r.name===name&&r.url===url&&r.status===200);
 if(old){try{if(hash(await readFile(join(dir,name)))===old.sha256){sources.push(old);continue;}}catch(e){if(e.code!=='ENOENT')throw e;}}
 const response=await fetch(url);if(!response.ok)throw new Error(`${response.status}: ${url}`);
 const bytes=new Uint8Array(await response.arrayBuffer());await writeFile(join(dir,name),bytes);sources.push({name,url,status:response.status,bytes:bytes.length,sha256:hash(bytes)});
}
await writeFile(join(dir,'sources.json'),JSON.stringify(sources,null,2));
const temp=await mkdtemp(join(tmpdir(),'web-gta-player-'));
try{
 await writeFile(join(temp,'entry.ts'),['dff','txd','binary','remapPlayerSkin'].map(n=>`export * from ${JSON.stringify(resolve('src/assets',n+'.ts'))};`).join('\n'));
 await build({input:join(temp,'entry.ts'),platform:'node',output:{file:join(temp,'readers.mjs'),format:'esm'}});
 const {readDff,readTxd,BinaryReader,readChunk,remapPlayerSkin}=await import(pathToFileURL(join(temp,'readers.mjs'))),inspection=[];
 for(const source of sources){
  const bytes=new Uint8Array(await readFile(join(dir,source.name)));
  if(source.name.endsWith('.txd')){inspection.push({name:source.name,textures:readTxd(bytes).map(t=>({name:t.name,width:t.width,height:t.height,filter:t.filter,addressU:t.addressU,addressV:t.addressV}))});continue;}
  const stream=new BinaryReader(bytes);let clumps=0;
  while(stream.position+12<=bytes.length&&new DataView(bytes.buffer,bytes.byteOffset+stream.position,4).getUint32(0,true)===16){readChunk(stream);if(++clumps>16)throw new Error('Too many player clumps');}
  if(!clumps)throw new Error(`Missing model clumps: ${source.name}`);
  const models=[];
  for(let index=0;index<clumps;index++){
   const model=readDff(bytes,index);
   models.push({index,atomics:model.atomics.map(a=>({frame:model.frames[a.frame].name,geometry:a.geometry,flags:a.flags})),frames:model.frames.length,hierarchies:model.frames.filter(f=>f.hanim?.nodes.length).map(f=>({name:f.name,nodes:f.hanim.nodes})),geometries:model.geometries.map(g=>({vertices:g.positions.length/3,triangles:g.indices.length/3,bones:g.skin?.boneCount,materials:g.materials.map(m=>m.texture)})),warnings:model.warnings});
  }
  inspection.push({name:source.name,clumps,models});
 }
 const template=readDff(new Uint8Array(await readFile(join(dir,'player.dff')))),target=template.geometries[0].skin,targetHierarchy=template.frames.find(f=>f.hanim?.nodes.length)?.hanim;
 if(!target||!targetHierarchy)throw new Error('Player template has no complete skin hierarchy');
 const rigComparison=[];
 for(const item of inspection.filter(v=>v.models&&v.name!=='player.dff')){
  const bytes=new Uint8Array(await readFile(join(dir,item.name)));
  for(let clump=0;clump<item.clumps;clump++){
   const model=readDff(bytes,clump),hierarchy=model.frames.find(f=>f.hanim?.nodes.length)?.hanim;
   if(!hierarchy)throw new Error(`No body hierarchy in ${item.name}`);
   for(const geometry of model.geometries){
    if(!geometry.skin)throw new Error(`No body skin in ${item.name}`);
    const skin=remapPlayerSkin(geometry.skin,hierarchy,target,targetHierarchy);
    rigComparison.push({name:item.name,clump,variant:model.frames[model.atomics[0].frame].name,sourceBones:geometry.skin.boneCount,targetBones:skin.boneCount,weightedTargetBones:[...skin.usedBones],absentUnweightedIds:hierarchy.nodes.filter(n=>!targetHierarchy.nodes.some(t=>t.id===n.id)).map(n=>n.id)});
   }
  }
 }
 await writeFile(join(dir,'rig-comparison.json'),JSON.stringify(rigComparison,null,2));
 await writeFile(join(dir,'inspection.json'),JSON.stringify(inspection,null,2));
 console.log(`${sources.length} acquired files; ${inspection.filter(r=>r.models).reduce((n,r)=>n+r.clumps,0)} parsed model clumps; ${inspection.filter(r=>r.textures).length} parsed texture dictionaries.`);
 console.log(dir);
}finally{await rm(temp,{recursive:true,force:true});}
