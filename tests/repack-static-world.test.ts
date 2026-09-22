import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {readFile,writeFile,mkdir,rm,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {planStaticWorldChunks} from '../src/assets/staticWorldChunks';
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
/** Regroups the published world into the current chunk plan without the source depot: every entry's bytes come
 * from the published chunks, and nothing is replaced unless the new chunks reproduce the original archive's
 * SHA-256 (the directory, every entry and its sector padding, in archive order). Only chunks, ranges and the
 * packed size change in the manifest.
 *
 *   GTA_REPACK_WORLD=1 NODE_OPTIONS=--max-old-space-size=8192 npx vitest run tests/repack-static-world.test.ts
 *
 * GTA_REPACK_OUT=<dir> writes the new chunks and manifest there instead, leaving the published world untouched. */
test.skipIf(process.env.GTA_REPACK_WORLD!=='1')('repack the published static world into archive-ordered chunks',async()=>{
 const output='public/play/world',manifest=JSON.parse(await readFile(join(output,'manifest.json'),'utf8'));
 const directory=await readFile(join(output,manifest.archive.directory.file));
 expect(hash(directory)).toBe(manifest.archive.directory.sha256);
 const old=manifest.chunks.map((chunk:{file:string;sha256:string})=>{const packed=readFileSync(join(output,chunk.file));expect(hash(packed)).toBe(chunk.sha256);return gunzipSync(packed);});
 const entries=(manifest.ranges as {offset:number;length:number;chunk:number;start:number}[]).map(r=>({offset:r.offset,length:r.length,bytes:old[r.chunk].subarray(r.start,r.start+r.length)}));
 const target=process.env.GTA_REPACK_OUT,staging=target?join(target,'chunks'):join(output,'chunks.next');await rm(staging,{recursive:true,force:true});await mkdir(staging,{recursive:true});
 const chunks:{file:string;bytes:number;expandedBytes:number;sha256:string}[]=[],ranges:{offset:number;length:number;chunk:number;start:number}[]=[];let packedBytes=0;
 for(const group of planStaticWorldChunks(entries)){
  let start=0;for(const entry of group){ranges.push({offset:entry.offset,length:entry.length,chunk:chunks.length,start});start+=entry.length;}
  const raw=Buffer.concat(group.map(e=>e.bytes)),packed=gzipSync(raw,{level:6}),name=`${String(chunks.length).padStart(4,'0')}.bin`;
  await writeFile(join(staging,name),packed);chunks.push({file:`chunks/${name}`,bytes:packed.length,expandedBytes:raw.length,sha256:hash(packed)});packedBytes+=packed.length;
 }
 ranges.sort((a,b)=>a.offset-b.offset);
 // The original archive, rebuilt from what was just written.
 const digest=createHash('sha256').update(directory);let at=directory.length,current=-1,expanded:Buffer|undefined;
 for(const range of ranges){
  if(range.offset>at){digest.update(Buffer.alloc(range.offset-at));at=range.offset;}
  if(range.chunk!==current){expanded=gunzipSync(readFileSync(join(staging,chunks[range.chunk].file.slice('chunks/'.length))));current=range.chunk;expect(expanded.length).toBe(chunks[current].expandedBytes);}
  digest.update(expanded!.subarray(range.start,range.start+range.length));at+=range.length;
 }
 if(at<manifest.archive.bytes)digest.update(Buffer.alloc(manifest.archive.bytes-at));
 expect(digest.digest('hex')).toBe(manifest.archive.sha256);
 if(!target){await rm(join(output,'chunks'),{recursive:true});await rename(staging,join(output,'chunks'));}
 await writeFile(join(target??output,'manifest.json'),JSON.stringify({...manifest,chunks,ranges,coverage:{...manifest.coverage,packedBytes}})+'\n');
 console.log(JSON.stringify({chunks:chunks.length,packedBytes,previous:{chunks:manifest.chunks.length,packedBytes:manifest.coverage.packedBytes}}));
},1800000);
