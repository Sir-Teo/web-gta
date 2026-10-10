import {test,expect} from 'vitest';
import {openAsBlob,createReadStream} from 'node:fs';
import {readFile,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {readImgIndex,readImgEntry} from '../src/assets/img';
import {planStaticWorldChunks} from '../src/assets/staticWorldChunks';
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
/** Publishes one of world-sources.json's extra archives beside gta3.img: its own manifest, directory and
 * content-addressed chunks under its base (MODELS\GTA_INT.IMG under public/play/world/int/, MODELS\CUTSCENE.IMG under
 * cut/), and the world manifest's `archives` list naming it (CStreaming opens them after gta3.img; staticWorldArchive.ts
 * joins them).
 *
 *   node scripts/content/acquire-world.mjs /absolute/content-directory
 *   GTA_PUBLISH_INTERIORS=1 GTA_CONTENT_DIR=/absolute/content-directory npx vitest run tests/build-interior-archive.test.ts
 *   GTA_PUBLISH_ARCHIVE=cutscene.img GTA_CONTENT_DIR=/absolute/content-directory npx vitest run tests/build-interior-archive.test.ts */
const archiveName=process.env.GTA_PUBLISH_ARCHIVE??(process.env.GTA_PUBLISH_INTERIORS==='1'?'gta_int.img':undefined);
test.skipIf(!archiveName)('publish an extra archive as static chunks beside the world',async()=>{
 const depot=process.env.GTA_CONTENT_DIR;if(!depot)throw new Error('GTA_CONTENT_DIR is required.');
 const world='public/play/world',lock=JSON.parse(await readFile('scripts/content/world-sources.json','utf8'));
 const locked=(lock.extraArchives as {path:string;url:string;bytes:number;sha256:string;base:string}[]).find(a=>a.path===archiveName)!;
 const source=join(depot,locked.path),digest=createHash('sha256');let bytes=0;
 for await(const chunk of createReadStream(source)){digest.update(chunk);bytes+=chunk.length;}
 expect(bytes).toBe(locked.bytes);expect(digest.digest('hex')).toBe(locked.sha256);
 const archive=await openAsBlob(source),entries=await readImgIndex(archive);
 const output=join(world,locked.base);await rm(output,{recursive:true,force:true});await mkdir(join(output,'chunks'),{recursive:true});
 const directory=Buffer.from(await archive.slice(0,8+entries.length*32).arrayBuffer());await writeFile(join(output,'directory.bin'),directory);
 const chunks:{file:string;bytes:number;expandedBytes:number;sha256:string}[]=[],ranges:{offset:number;length:number;chunk:number;start:number}[]=[];let packedBytes=0;
 for(const group of planStaticWorldChunks(entries)){
  const parts:Uint8Array[]=[];let start=0;
  for(const entry of group){const data=await readImgEntry(archive,entry);ranges.push({offset:entry.offset,length:entry.length,chunk:chunks.length,start});parts.push(data);start+=data.length;}
  const raw=Buffer.concat(parts),packed=gzipSync(raw,{level:6}),name=`${hash(packed).slice(0,20)}.bin`;
  await writeFile(join(output,'chunks',name),packed);chunks.push({file:`chunks/${name}`,bytes:packed.length,expandedBytes:raw.length,sha256:hash(packed)});packedBytes+=packed.length;
 }
 ranges.sort((a,b)=>a.offset-b.offset);
 const manifest={version:1,archive:{name:locked.path,bytes:archive.size,sha256:locked.sha256,source:locked.url,directory:{file:'directory.bin',bytes:directory.length,sha256:hash(directory)}},chunks,ranges,resources:[],coverage:{archiveEntries:entries.length,packedBytes}};
 await writeFile(join(output,'manifest.json'),JSON.stringify(manifest)+'\n');
 const primary=JSON.parse(await readFile(join(world,'manifest.json'),'utf8'));
 // In the lock's order, as the game opens them.
 const order=(lock.extraArchives as {path:string}[]).map(a=>a.path);
 primary.archives=[...(primary.archives??[]).filter((a:{name:string})=>a.name!==locked.path),{name:locked.path,base:locked.base}].sort((a:{name:string},b:{name:string})=>order.indexOf(a.name)-order.indexOf(b.name));
 await writeFile(join(world,'manifest.json'),JSON.stringify(primary)+'\n');
 console.log(JSON.stringify(manifest.coverage));
},600000);
