import {AssetFormatError,WorldDownloadError,requireAsset} from './binary';
export {WorldDownloadError};
import {readImgIndex} from './img';
/** `packed`: a gzip copy published beside the raw file (scripts/pack-world-resources.mjs); `bytes` and `sha256` describe
 * the expanded content either way. */
export interface StaticWorldResource {path:string;bytes:number;sha256:string;url?:string;packed?:{file:string;bytes:number}}
export interface StaticWorldManifest {
 version:1;
 archive:{name:string;bytes:number;sha256:string;directory:{file:string;bytes:number;sha256:string}};
 chunks:{file:string;bytes:number;expandedBytes:number;sha256:string}[];
 ranges:{offset:number;length:number;chunk:number;start:number}[];
 resources:StaticWorldResource[];
 /** Further IMGs CStreaming opens after gta3.img (MODELS\GTA_INT.IMG), each published as its own chunk set at `base`. */
 archives?:{name:string;base:string}[];
}
const LIMIT=64*1024*1024;
/** The decoded chunks a thread keeps for later reads (one budget for a world's IMGs): the most a chunk or a read may
 * be, 64 MB, unless a phone asks for less (setChunkCacheBudget). The page and the streaming worker each keep their own,
 * and a chunk dropped is only fetched again from Cache Storage and inflated. */
let retainedLimit=LIMIT;
export function setChunkCacheBudget(bytes:number){retainedLimit=Math.max(0,Math.min(LIMIT,bytes));}
function safePath(path:string){return typeof path==='string'&&/^[a-zA-Z0-9_./-]+$/.test(path)&&!path.startsWith('/')&&!path.split('/').some(p=>p==='..'||p==='');}
function validateResource(resource:{bytes:number;sha256:string}){requireAsset(Number.isSafeInteger(resource.bytes)&&resource.bytes>0&&resource.bytes<=LIMIT&&/^[a-f0-9]{64}$/.test(resource.sha256),'Invalid static world resource.');}
async function collect(stream:ReadableStream<Uint8Array>,limit:number,progress?:()=>void){
 const reader=stream.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;progress?.();size+=value.length;requireAsset(size<=limit,'Static world resource exceeds its byte limit.');chunks.push(value);}}
 catch(error){await reader.cancel();throw error;}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
/** A download that receives nothing for this long is abandoned, so a request the network never answers fails (and is
 * retried by its caller) instead of holding the world worker, and every window queued behind it, for good. */
export const WORLD_STALL_MS=20000;
/** The caller's signal, also aborted once `stallMs` pass without `alive()` being called. */
export function stallGuard(signal?:AbortSignal,stallMs=WORLD_STALL_MS){
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 const abort=()=>controller.abort(signal!.reason);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 const alive=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(new Error('World content download stalled.')),stallMs);};alive();
 return {signal:controller.signal,alive,done:()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);}};
}
async function fetchWorldResource(url:URL,signal?:AbortSignal,cache:RequestCache='default'){
 for(let attempt=0;;attempt++){
  signal?.throwIfAborted();
  try{
   const response=await fetch(url,{signal,cache});
   if(attempt===2||![408,429,500,502,503,504].includes(response.status))return response;
   await response.body?.cancel();
  }catch(error){if(signal?.aborted||attempt===2)throw error;}
  await new Promise<void>((resolve,reject)=>{
   const abort=()=>{clearTimeout(timer);reject(signal!.reason);};
   const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},attempt===0?250:1000);
   signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  });
 }
}
const sha256Hex=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>)),b=>b.toString(16).padStart(2,'0')).join('');
/** Downloaded world bytes kept across sessions, keyed by their SHA-256 (GitHub Pages revalidates after ten minutes and
 * every deploy changes the ETags, so the HTTP cache alone re-downloads the world). Content addressing makes entries
 * immutable; anything unusable (no Cache Storage, a quota error, a corrupt entry) falls back to the network. */
export const WORLD_CACHE='web-gta-world-v1';
/** One key per resource for the page and its workers alike: the app root, not the current script's own URL (a worker's
 * would put every entry under its assets folder, twice over, and each context's pruning would drop the other's). */
export const worldCacheKey=(sha256:string)=>new URL(`${import.meta.env?.BASE_URL??'/'}__world/${sha256}`,globalThis.location?.origin??'https://cache.invalid').href;
const cacheKey=worldCacheKey;
async function worldCache(){try{return typeof caches!=='undefined'?await caches.open(WORLD_CACHE):undefined;}catch{return undefined;}}
/** `hash`: check the kept copy against its SHA-256 (it was checked when stored; a caller that checks the bytes some
 * other way need not pay for it again). */
async function cachedWorldBytes(resource:{bytes:number;sha256:string},hash=true){
 try{
  const hit=await (await worldCache())?.match(cacheKey(resource.sha256));if(!hit)return undefined;
  const bytes=new Uint8Array(await hit.arrayBuffer());
  return bytes.length===resource.bytes&&(!hash||await sha256Hex(bytes)===resource.sha256)?bytes:undefined;
 }catch{return undefined;}
}
async function forgetWorldBytes(resource:{sha256:string}){try{await (await worldCache())?.delete(cacheKey(resource.sha256));}catch{/* Downloaded and stored over regardless. */}}
function storeWorldBytes(resource:{sha256:string},bytes:Uint8Array){
 void worldCache().then(cache=>cache?.put(cacheKey(resource.sha256),new Response(bytes as Uint8Array<ArrayBuffer>,{headers:{'content-type':'application/octet-stream'}}))).catch(()=>{});
}
/** Drops cached entries the current manifest no longer names (a republished world's old chunks). */
export async function pruneWorldCache(keep:Iterable<string>){
 try{
  const cache=await worldCache();if(!cache)return 0;
  const wanted=new Set([...keep].map(cacheKey));let removed=0;
  for(const request of await cache.keys())if(!wanted.has(request.url)&&await cache.delete(request))removed++;
  return removed;
 }catch{return 0;}
}
/** On the page's own thread the world's bytes are fetched, checked, kept and inflated by a worker
 * (worldBytes.worker), the bytes handed back without a copy: at a first start the page spent some 600 ms of the
 * thread its frames and touches run on doing it (storing each chunk in Cache Storage a third of that, its hash and
 * the inflating most of the rest), a phone more. The streaming worker, and anywhere without workers, works in place;
 * so does the page if the worker cannot start. */
type BytesJob={resolve:(bytes:Uint8Array<ArrayBuffer>)=>void;reject:(error:unknown)=>void};
type BytesRequest={url:string;resource:{bytes:number;sha256:string;expandedBytes?:number};chunk?:boolean;gzip?:boolean};
export type BytesFailure={kind:'download'|'format'|'other';message:string};
const WORKER_FAILED=Symbol('world bytes worker failed');
let bytesHelper:{worker:Worker;jobs:Map<number,BytesJob>;next:number}|null|undefined;
function bytesWorker(){
 if(bytesHelper!==undefined)return bytesHelper;
 bytesHelper=null;
 if(typeof document==='undefined'||typeof Worker==='undefined')return null;
 try{
  const worker=new Worker(new URL('./worldBytes.worker.ts',import.meta.url),{type:'module'}),jobs=new Map<number,BytesJob>();
  worker.onmessage=({data}:MessageEvent<{id:number;bytes?:Uint8Array<ArrayBuffer>;error?:BytesFailure}>)=>{
   const job=jobs.get(data.id);if(!job)return;jobs.delete(data.id);
   if(!data.error)job.resolve(data.bytes!);
   else{const {kind,message}=data.error;job.reject(kind==='download'?new WorldDownloadError(message):kind==='format'?new AssetFormatError(message):new Error(message));}
  };
  worker.onerror=()=>{bytesHelper=null;worker.terminate();for(const job of jobs.values())job.reject(WORKER_FAILED);jobs.clear();};
  bytesHelper={worker,jobs,next:0};
 }catch{bytesHelper=null;}
 return bytesHelper;
}
async function offThread(request:BytesRequest,signal:AbortSignal|undefined,here:()=>Promise<Uint8Array<ArrayBuffer>>){
 const helper=bytesWorker();if(!helper)return here();
 signal?.throwIfAborted();
 const id=helper.next++;
 try{
  return await new Promise<Uint8Array<ArrayBuffer>>((resolve,reject)=>{
   const abort=()=>{helper.jobs.delete(id);helper.worker.postMessage({id,abort:true});reject(signal!.reason);};
   signal?.addEventListener('abort',abort,{once:true});
   const settle=()=>signal?.removeEventListener('abort',abort);
   helper.jobs.set(id,{resolve:bytes=>{settle();resolve(bytes);},reject:error=>{settle();reject(error);}});
   helper.worker.postMessage({id,...request});
  });
 }catch(error){if(error===WORKER_FAILED)return here();throw error;}
}
/** `gzip`: the file at `url` is a gzip stream of the resource. */
export function fetchStaticWorldBytes(url:URL,resource:{bytes:number;sha256:string},signal?:AbortSignal,gzip=false){
 return offThread({url:url.href,resource:{bytes:resource.bytes,sha256:resource.sha256},gzip},signal,()=>fetchHere(url,resource,signal,gzip));
}
/** `kept`: whether a copy in Cache Storage may answer. */
async function fetchHere(url:URL,resource:{bytes:number;sha256:string},signal?:AbortSignal,gzip=false,kept=true){
 validateResource(resource);
 const cached=kept?await cachedWorldBytes(resource):undefined;if(cached)return cached;
 // Kept here by checksum, a download passes the browser's HTTP cache by: it would hold a second copy of every chunk a
 // phone streams (the whole world is 617 MB), and evict other sites' entries for it. Without Cache Storage the HTTP
 // cache is the only one, and a stale copy of a republished path fails the checksum once, so a second attempt
 // bypasses it.
 const modes:RequestCache[]=await worldCache()?['no-store']:['default','reload'];
 for(const mode of modes){
  const guard=stallGuard(signal);let bytes:Uint8Array<ArrayBuffer>;
  try{
   let response:Response;
   try{response=await fetchWorldResource(url,guard.signal,mode);}
   catch(error){if(signal?.aborted)throw error;throw new WorldDownloadError(`World content download failed: ${url.pathname}`,{cause:error});}
   // A file the server does not have is the archive's fault, like bytes that do not decode; any other refusal is
   // the connection's.
   if(!response.ok&&response.status!==404)throw new WorldDownloadError(`World content download failed (${response.status}): ${url.pathname}`);
   requireAsset(response.ok&&response.body,`World content download failed: ${url.pathname}`);
   const body=gzip?response.body!.pipeThrough(new DecompressionStream('gzip')):response.body!;
   try{bytes=await collect(body,resource.bytes,guard.alive);}
   catch(error){if(signal?.aborted||error instanceof AssetFormatError)throw error;throw new WorldDownloadError(`World content download broke off: ${url.pathname}`,{cause:error});}
  }finally{guard.done();}
  requireAsset(bytes.length===resource.bytes,'Incomplete static world resource.');
  if(await sha256Hex(bytes)===resource.sha256){storeWorldBytes(resource,bytes);return bytes;}
  if(mode==='reload')break;
 }
 throw new AssetFormatError(`World content checksum mismatch: ${url.pathname}`);
}
/** A chunk's bytes, inflated. A copy kept in Cache Storage was hashed as it was stored; read back, the gzip stream's own
 * CRC-32 and length vouch for it rather than hashing it again on every start, the main thread's largest cost after
 * its shaders as the world comes up (tens of megabytes before the player stands, a phone's CPU without SHA
 * instructions the slowest at it). A kept copy that fails them is dropped and downloaded again. */
export function worldChunk(url:URL,spec:{bytes:number;sha256:string;expandedBytes:number},signal?:AbortSignal){
 return offThread({url:url.href,resource:{bytes:spec.bytes,sha256:spec.sha256,expandedBytes:spec.expandedBytes},chunk:true},signal,()=>chunkHere(url,spec,signal));
}
async function chunkHere(url:URL,spec:{bytes:number;sha256:string;expandedBytes:number},signal?:AbortSignal){
 const inflate=async(packed:Uint8Array<ArrayBuffer>)=>{
  // Stream the bytes straight into the inflater: wrapping them in a Blob first copies the chunk into the browser's
  // blob store.
  const source=new ReadableStream<Uint8Array<ArrayBuffer>>({start(controller){controller.enqueue(packed);controller.close();}});
  const bytes=await collect(source.pipeThrough(new DecompressionStream('gzip')),spec.expandedBytes);requireAsset(bytes.length===spec.expandedBytes,'Incomplete expanded world chunk.');
  return bytes;
 };
 const kept=await cachedWorldBytes(spec,false);
 if(kept)try{return await inflate(kept);}catch{await forgetWorldBytes(spec);}
 return inflate(await fetchHere(url,spec,signal,false,false));
}
/** Blob views stay lazy. Worker creates this adapter locally; it must not be structured-cloned. */
class ArchiveSlice extends Blob {
 constructor(private from:number,private to:number,private read:(from:number,to:number)=>Promise<Uint8Array>,type=''){super([],{type});}
 override get size(){return this.to-this.from;}
 override async arrayBuffer():Promise<ArrayBuffer>{return (await this.read(this.from,this.to)).buffer as ArrayBuffer;}
 override async bytes(){return new Uint8Array(await this.arrayBuffer());}
 override async text(){return new TextDecoder().decode(await this.arrayBuffer());}
 override stream():ReadableStream<Uint8Array<ArrayBuffer>>{return new ReadableStream({start:async controller=>{try{controller.enqueue(new Uint8Array(await this.arrayBuffer()));controller.close();}catch(error){controller.error(error);}}});}
 override slice(start=0,end=this.size,type=''){const offset=(n:number)=>Math.max(0,Math.min(this.size,n<0?this.size+Math.trunc(n):Math.trunc(n)));const a=offset(start),b=Math.max(a,offset(end));return new ArchiveSlice(this.from+a,this.from+b,this.read,type);}
}
class ArchiveFile extends File {
 constructor(private archiveSize:number,private read:(from:number,to:number)=>Promise<Uint8Array>){super([],'gta3.img');}
 override get size(){return this.archiveSize;}
 /** One native entry's bytes without constructing slice Blobs (readImgEntry's fast path). */
 readRange(from:number,to:number){return this.read(from,to);}
 override slice(start=0,end=this.size,type=''){const offset=(n:number)=>Math.max(0,Math.min(this.size,n<0?this.size+Math.trunc(n):Math.trunc(n)));const a=offset(start);return new ArchiveSlice(a,Math.max(a,offset(end)),this.read,type);}
 override arrayBuffer(){return this.slice().arrayBuffer();}
 override bytes(){return this.slice().bytes();}
 override text(){return this.slice().text();}
 override stream(){return this.slice().stream();}
}
/** One archive per base URL on this thread. Every subsystem used to open its own: the manifest and directory
 * were fetched, checksummed and parsed a dozen times, and each copy kept its own 64 MB chunk cache, so the same
 * chunks were downloaded and decompressed several times over. A signal gets a private archive, as aborting a
 * shared one would fail every other user. */
const openArchives=new Map<string,ReturnType<typeof openArchive>>();
export function openStaticWorld(baseUrl:string,signal?:AbortSignal){
 if(signal)return openArchive(baseUrl,signal);
 const key=new URL(baseUrl,globalThis.location?.href).href;
 let archive=openArchives.get(key);
 if(!archive){archive=openArchive(baseUrl);openArchives.set(key,archive);archive.catch(()=>{if(openArchives.get(key)===archive)openArchives.delete(key);});}
 return archive;
}
/** One published IMG: original offsets backed by immutable same-origin gzip chunks, with bounded retained decoded data. */
/** The decoded chunks every IMG of one world keeps, least recently used first: one budget (LIMIT) for gta3.img and
 * gta_int.img together, so a second archive does not double what a world retains. */
interface ChunkBudget {retained:number;order:Map<string,{bytes:number;drop:()=>void}>}
async function openImg(base:URL,name:string,signal?:AbortSignal,budget:ChunkBudget={retained:0,order:new Map()}){
 const response=await fetchWorldResource(new URL('manifest.json',base),signal,'no-cache');requireAsset(response.ok&&response.body,'World manifest download failed.');
 const manifest=JSON.parse(new TextDecoder().decode(await collect(response.body!,16*1024*1024))) as StaticWorldManifest;
 requireAsset(manifest.version===1&&manifest.archive?.name===name&&Number.isSafeInteger(manifest.archive.bytes)&&manifest.archive.bytes>0&&manifest.archive.bytes<=2*1024*1024*1024,'Invalid static world archive.');
 requireAsset(Array.isArray(manifest.chunks)&&manifest.chunks.length>0&&manifest.chunks.length<=4096&&Array.isArray(manifest.ranges)&&manifest.ranges.length<=200000&&Array.isArray(manifest.resources)&&manifest.resources.length<=2048,'Invalid world content inventory.');
 const directorySpec=manifest.archive.directory;validateResource(directorySpec);requireAsset(safePath(directorySpec.file),'Invalid archive directory path.');
 const paths=new Set<string>();
 for(const chunk of manifest.chunks){validateResource(chunk);requireAsset(safePath(chunk.file)&&!paths.has(chunk.file)&&Number.isSafeInteger(chunk.expandedBytes)&&chunk.expandedBytes>0&&chunk.expandedBytes<=LIMIT,'Invalid world chunk.');paths.add(chunk.file);}
 const byOffset=new Map<number,typeof manifest.ranges[number]>();let previousEnd=directorySpec.bytes;
 for(const range of manifest.ranges){const chunk=manifest.chunks[range.chunk];requireAsset([range.offset,range.length,range.chunk,range.start].every(Number.isSafeInteger)&&range.offset>=previousEnd&&range.length>0&&range.offset+range.length<=manifest.archive.bytes&&range.start>=0&&chunk&&range.start+range.length<=chunk.expandedBytes,'Invalid world entry range.');previousEnd=range.offset+range.length;byOffset.set(range.offset,range);}
 const resourceNames=new Set<string>();for(const resource of manifest.resources){validateResource(resource);requireAsset(safePath(resource.path)&&!resourceNames.has(resource.path.toLowerCase()),'Invalid or duplicate world resource path.');if(resource.packed)requireAsset(safePath(resource.packed.file)&&Number.isSafeInteger(resource.packed.bytes)&&resource.packed.bytes>0&&resource.packed.bytes<=LIMIT,'Invalid packed world resource.');resourceNames.add(resource.path.toLowerCase());}
 const directory=await fetchStaticWorldBytes(new URL(directorySpec.file,base),directorySpec,signal);
 const cache=new Map<number,Uint8Array>(),pending=new Map<number,Promise<Uint8Array>>();let retainedBytes=0,downloads=0;
 const key=(index:number)=>`${name}:${index}`;
 async function chunkBytes(index:number){
  const cached=cache.get(index);if(cached){const held=budget.order.get(key(index));if(held){budget.order.delete(key(index));budget.order.set(key(index),held);}return cached;}
  const existing=pending.get(index);if(existing)return existing;
  const task=(async()=>{const spec=manifest.chunks[index],bytes=await worldChunk(new URL(spec.file,base),spec,signal);downloads++;
   while(budget.retained+bytes.length>retainedLimit&&budget.order.size)budget.order.values().next().value!.drop();
   cache.set(index,bytes);retainedBytes+=bytes.length;budget.retained+=bytes.length;
   budget.order.set(key(index),{bytes:bytes.length,drop:()=>{cache.delete(index);retainedBytes-=bytes.length;budget.retained-=bytes.length;budget.order.delete(key(index));}});
   return bytes;
  })();pending.set(index,task);try{return await task;}finally{pending.delete(index);}
 }
 const read=async(from:number,to:number)=>{
  requireAsset(Number.isSafeInteger(from)&&Number.isSafeInteger(to)&&from>=0&&to>=from&&to<=manifest.archive.bytes&&to-from<=LIMIT,'Unsupported static archive read.');
  if(to<=directory.length)return directory.slice(from,to);
  const range=byOffset.get(from);requireAsset(range&&to===from+range.length,'Static archive reads must select one complete native entry.');
  const bytes=await chunkBytes(range!.chunk);return bytes.slice(range!.start,range!.start+range!.length);
 };
 const file=new ArchiveFile(manifest.archive.bytes,read);
 const entries=await readImgIndex(file);requireAsset(entries.length===manifest.ranges.length&&entries.every(e=>byOffset.get(e.offset)?.length===e.length),'World archive directory and chunk inventory disagree.');
 return {manifest,file,entries,read,stats:()=>({downloads,retainedBytes,pending:pending.size})};
}
type OpenedImg=Awaited<ReturnType<typeof openImg>>;
const SECTOR=2048;
/** CStreaming::LoadCdDirectory over several IMGs as one virtual VER2 archive: a combined directory first, gta3.img's
 * entries shifted just past it, each further IMG's after the one before. A name already loaded keeps its first IMG
 * (`HasCdPosnAndSize`). Offsets are virtual; every read still selects one complete original entry. */
export function combineImgs(images:readonly {entries:readonly {name:string;offset:number;length:number}[];bytes:number;read:(from:number,to:number)=>Promise<Uint8Array>}[]){
 const names=new Set<string>(),kept=images.map(image=>image.entries.filter(e=>{const key=e.name.toLowerCase();if(names.has(key))return false;names.add(key);return true;}));
 const count=kept.reduce((n,list)=>n+list.length,0),directoryBytes=Math.ceil((8+count*32)/SECTOR)*SECTOR;
 const first=Math.min(...images[0].entries.map(e=>e.offset)),bases:number[]=[];
 let base=Math.max(0,directoryBytes-first);
 for(const image of images){bases.push(base);base+=image.bytes;}
 const size=base,directory=new Uint8Array(8+count*32),view=new DataView(directory.buffer),lookup=new Map<number,{image:number;offset:number;length:number}>();
 directory.set([86,69,82,50]);view.setUint32(4,count,true);
 let at=8;
 kept.forEach((list,image)=>{for(const e of list){
  const offset=bases[image]+e.offset;requireAsset(offset%SECTOR===0&&e.length%SECTOR===0&&e.length/SECTOR<=0xffff,'Unsupported combined IMG entry.');
  view.setUint32(at,offset/SECTOR,true);view.setUint16(at+4,e.length/SECTOR,true);view.setUint16(at+6,0,true);
  for(let i=0;i<24;i++)directory[at+8+i]=i<e.name.length?e.name.charCodeAt(i):0;
  lookup.set(offset,{image,offset:e.offset,length:e.length});at+=32;
 }});
 const read=async(from:number,to:number)=>{
  if(to<=directory.length)return directory.slice(from,to);
  const hit=lookup.get(from);requireAsset(hit&&to===from+hit.length,'Static archive reads must select one complete native entry.');
  return images[hit!.image].read(hit!.offset,hit!.offset+hit!.length);
 };
 return {size,read};
}
async function openArchive(baseUrl:string,signal?:AbortSignal){
 const base=new URL(baseUrl,globalThis.location?.href);requireAsset(base.pathname.endsWith('/'),'Static world base URL must end with /.');
 const budget:ChunkBudget={retained:0,order:new Map()};
 const primary=await openImg(base,'gta3.img',signal,budget),manifest=primary.manifest;
 requireAsset(manifest.archives===undefined||Array.isArray(manifest.archives)&&manifest.archives.length<=4&&manifest.archives.every(a=>typeof a.name==='string'&&/^[a-z0-9_]+\.img$/i.test(a.name)&&typeof a.base==='string'&&a.base.endsWith('/')&&safePath(a.base.slice(0,-1))),'Invalid world archive list.');
 const extra:OpenedImg[]=await Promise.all((manifest.archives??[]).map(a=>openImg(new URL(a.base,base),a.name,signal,budget)));
 let file:File=primary.file,entries=primary.entries;
 if(extra.length){
  const combined=combineImgs([primary,...extra].map(image=>({entries:image.entries,bytes:image.manifest.archive.bytes,read:image.read})));
  file=new ArchiveFile(combined.size,combined.read);entries=await readImgIndex(file);
 }
 const archives=[primary,...extra].map(image=>image.manifest.archive.name);
 // Loose resources (ped.ifp, data files) are shared by several subsystems: fetch and verify each once.
 const resources=new Map<StaticWorldResource,Promise<Uint8Array>>();
 // Names are unique without case (readImgIndex rejects duplicates): index them once for every caller's lookups, which
 // otherwise scanned all 16,297 entries, lower-casing each, per model a pedestrian or pickup spawned.
 let byName:Map<string,typeof entries[number]>|undefined;
 const entry=(name:string)=>(byName??=new Map(entries.map(e=>[e.name.toLowerCase(),e]))).get(name.toLowerCase());
 /** Every SHA-256 the opened archives reference, for pruning the persistent cache. */
 const hashes=()=>[primary,...extra].flatMap(image=>[image.manifest.archive.directory.sha256,...image.manifest.chunks.map(c=>c.sha256),...image.manifest.resources.map(r=>r.sha256)]);
 return {file,entries,entry,hashes,manifest,base,archives,stats:()=>{const all=[primary,...extra].map(image=>image.stats());return {downloads:all.reduce((n,s)=>n+s.downloads,0),retainedBytes:all.reduce((n,s)=>n+s.retainedBytes,0),pending:all.reduce((n,s)=>n+s.pending,0)};},
  async resource(resource:StaticWorldResource){
   requireAsset(manifest.resources.includes(resource),'Unknown world resource.');
   let bytes=resources.get(resource);
   if(!bytes){bytes=resource.packed?fetchStaticWorldBytes(new URL(resource.packed.file,base),resource,signal,true):fetchStaticWorldBytes(new URL('files/'+resource.path,base),resource,signal);resources.set(resource,bytes);bytes.catch(()=>resources.delete(resource));}
   return new File([(await bytes) as Uint8Array<ArrayBuffer>],resource.path.split('/').at(-1)!);
  },
 };
}
