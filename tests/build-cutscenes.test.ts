import {test,expect} from 'vitest';
import {openAsBlob,createReadStream} from 'node:fs';
import {readFile,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {readImgIndex,readImgEntry} from '../src/assets/img';
import {readIfp} from '../src/assets/ifp';
import {writeAnp3,compressedOnLoad} from '../src/assets/ifpWrite';
import {readCutsceneFile,readCutsceneCameraPaths} from '../src/assets/cutscene';
import {findCutsceneAudioTrackId} from '../src/engine/ScmCutsceneTrack';
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const text=(b:Uint8Array)=>Buffer.from(b).toString('latin1').replace(/\0+$/,'');
/** Publishes the cutscenes cutscene-sources.json lists from ANIM\CUTS.IMG under public/play/cuts/: each one's .cut and
 * .dat as they are, and its clips as the game holds them once loaded (ANP3, compressed but for the "uncompress"
 * section's, gzipped), with a manifest of their hashes and each one's stream track (FindCutsceneAudioTrackId), which
 * scripts/content/package-stream-tracks.mjs packages next.
 *
 *   node scripts/content/acquire-cutscenes.mjs /absolute/content-directory
 *   GTA_PUBLISH_CUTSCENES=1 GTA_CONTENT_DIR=/absolute/content-directory npx vitest run tests/build-cutscenes.test.ts */
test.skipIf(process.env.GTA_PUBLISH_CUTSCENES!=='1')('publish the listed cutscenes',async()=>{
 const depot=process.env.GTA_CONTENT_DIR;if(!depot)throw new Error('GTA_CONTENT_DIR is required.');
 const lock=JSON.parse(await readFile('scripts/content/cutscene-sources.json','utf8')) as {cutsImg:{path:string;url:string;bytes:number;sha256:string};published:string[]};
 const source=join(depot,lock.cutsImg.path),digest=createHash('sha256');let bytes=0;
 for await(const chunk of createReadStream(source)){digest.update(chunk);bytes+=chunk.length;}
 expect(bytes).toBe(lock.cutsImg.bytes);expect(digest.digest('hex')).toBe(lock.cutsImg.sha256);
 const archive=await openAsBlob(source),entries=await readImgIndex(archive);
 const entry=(name:string)=>{const e=entries.find(x=>x.name.toLowerCase()===name);if(!e)throw new Error(`cuts.img has no ${name}.`);return readImgEntry(archive,e);};
 const output='public/play/cuts';await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
 const file=async(name:string,data:Uint8Array,expanded?:number)=>{await writeFile(join(output,name),data);return {file:name,bytes:data.length,...expanded===undefined?{}:{expandedBytes:expanded},sha256:hash(data)};};
 const cutscenes:Record<string,unknown>={};let total=0;
 for(const name of lock.published){
  const cut=text(await entry(`${name}.cut`)),dat=text(await entry(`${name}.dat`)),definition=readCutsceneFile(cut);
  readCutsceneCameraPaths(dat);
  const ifp=readIfp(await entry(`${name}.ifp`));expect(ifp.format).toBe('ANPK');
  // Every clip the .cut asks for is in the package.
  for(const member of definition.cast)expect(ifp.animations.some(a=>a.name.toLowerCase()===member.anim),`${name}: ${member.anim}`).toBe(true);
  const anp3=writeAnp3(ifp,animation=>compressedOnLoad(animation,definition.uncompressed)),packed=gzipSync(anp3,{level:9});
  // The published clips read back as the package's, to the compression's precision.
  const back=readIfp(gunzipSync(packed));expect(back.animations.map(a=>[a.name,a.tracks.length])).toEqual(ifp.animations.map(a=>[a.name,a.tracks.length]));
  cutscenes[name]={cut:await file(`${name}.cut`,Buffer.from(cut,'latin1')),dat:await file(`${name}.dat`,Buffer.from(dat,'latin1')),ifp:await file(`${name}.ifp.gz`,packed,anp3.length),...findCutsceneAudioTrackId(name)>=0?{track:findCutsceneAudioTrackId(name)}:{}};
  total+=packed.length;
 }
 await writeFile(join(output,'manifest.json'),JSON.stringify({version:1,source:{url:lock.cutsImg.url,bytes:lock.cutsImg.bytes,sha256:lock.cutsImg.sha256},cutscenes})+'\n');
 console.log(`${lock.published.length} cutscenes, clips ${(total/1048576).toFixed(1)} MB gzipped.`);
},600000);
