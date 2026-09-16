import {test,expect} from 'vitest';
import {openAsBlob,createReadStream} from 'node:fs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {readImgIndex,readImgEntry} from '../src/assets/img';
import {readIpl} from '../src/assets/ipl';
import {readVehicleIde} from '../src/assets/vehicleIde';
import {PLAYER_CLASSIC_FILES} from '../src/assets/readPlayerBaseBody';
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
test.skipIf(process.env.GTA_PUBLISH_WORLD!=='1')('publish the complete native archive as independently downloadable static chunks',async()=>{
 const depot=process.env.GTA_CONTENT_DIR;if(!depot)throw new Error('GTA_CONTENT_DIR is required.');
 const output='public/play/world',world=JSON.parse(await readFile('scripts/content/world-sources.json','utf8')),vehicles=JSON.parse(await readFile('scripts/content/vehicle-sources.json','utf8'));
 const source=join(depot,world.archive.path),digest=createHash('sha256');let bytes=0;
 for await(const chunk of createReadStream(source)){digest.update(chunk);bytes+=chunk.length;}
 expect(bytes).toBe(world.archive.bytes);expect(digest.digest('hex')).toBe(world.archive.sha256);
 const archive=await openAsBlob(source),entries=await readImgIndex(archive);
 await mkdir(join(output,'chunks'),{recursive:true});
 const directory=Buffer.from(await archive.slice(0,8+entries.length*32).arrayBuffer());await writeFile(join(output,'directory.bin'),directory);
 const chunks:{file:string;bytes:number;expandedBytes:number;sha256:string}[]=[],ranges:{offset:number;length:number;chunk:number;start:number}[]=[];
 let pending:Uint8Array[]=[],size=0,packedBytes=0;
 async function flush(){if(!size)return;const raw=Buffer.concat(pending),packed=gzipSync(raw,{level:6}),file=`chunks/${String(chunks.length).padStart(4,'0')}.bin`;
  await writeFile(join(output,file),packed);chunks.push({file,bytes:packed.length,expandedBytes:raw.length,sha256:hash(packed)});packedBytes+=packed.length;pending=[];size=0;
 }
 // Group related resource types, preserving every original entry byte and offset in the virtual archive.
 const sorted=[...entries].sort((a,b)=>a.name.split('.').at(-1)!.localeCompare(b.name.split('.').at(-1)!)||a.offset-b.offset);
 let streamedPlacements=0;
 for(const entry of sorted){
  if(size&&size+entry.length>4*1024*1024)await flush();
  const data=await readImgEntry(archive,entry);
  ranges.push({offset:entry.offset,length:entry.length,chunk:chunks.length,start:size});pending.push(data);size+=data.length;
  if(entry.name.toLowerCase().endsWith('.ipl'))streamedPlacements+=readIpl(data).instances.length;
 }
 await flush();ranges.sort((a,b)=>a.offset-b.offset);
 const resources:{path:string;bytes:number;sha256:string;url?:string}[]=[];let staticPlacements=0;
 const sourceResources=[...world.resources,...vehicles.resources];
  const extra=[...PLAYER_CLASSIC_FILES.map(name=>`player/${name}`),'animations/ped.ifp','animations/drivebys.ifp','animations/player_dvbys.ifp','animations/rustler.ifp','animations/shamal.ifp','animations/nevada.ifp','animations/swim.ifp'];
 for(const resource of [...sourceResources,...extra.map(path=>({path}))]){
  if(resource.path===world.archive.path||resources.some(r=>r.path===resource.path))continue;
  const data=await readFile(join(depot,resource.path));
  if('sha256' in resource){expect(data.length).toBe(resource.bytes);expect(hash(data)).toBe(resource.sha256);}
  const destination=join(output,'files',resource.path);await mkdir(dirname(destination),{recursive:true});await writeFile(destination,data);
  resources.push({path:resource.path,bytes:data.length,sha256:hash(data),...('url' in resource?{url:resource.url}:{})});
  if(resource.path.startsWith('ipl/'))staticPlacements+=readIpl(data).instances.length;
 }
 const definitions=readVehicleIde(await readFile(join(depot,'vehicles/vehicles.ide'),'utf8')).records;
 const archiveNames=new Set(entries.map(e=>e.name.toLowerCase()));
 const vehicleCatalog=definitions.map(v=>({...v,modelAvailable:archiveNames.has(v.model.toLowerCase()+'.dff'),dictionaryAvailable:archiveNames.has(v.dictionary.toLowerCase()+'.txd')}));
 const manifest={version:1,archive:{name:'gta3.img',bytes:archive.size,sha256:world.archive.sha256,source:world.compressedArchive.url,directory:{file:'directory.bin',bytes:directory.length,sha256:hash(directory)}},chunks,ranges,resources,vehicles:vehicleCatalog,
  coverage:{archiveEntries:entries.length,staticPlacements,streamedPlacements,vehicleDefinitions:definitions.length,vehicleTypes:Object.fromEntries([...new Set(definitions.map(v=>v.type))].map(type=>[type,definitions.filter(v=>v.type===type).length])),packedBytes}};
 await writeFile(join(output,'manifest.json'),JSON.stringify(manifest)+'\n');
 console.log(JSON.stringify(manifest.coverage));
},600000);
