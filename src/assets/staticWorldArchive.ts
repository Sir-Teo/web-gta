import {requireAsset} from './binary';
import {readImgIndex} from './img';
export interface StaticWorldResource {path:string;bytes:number;sha256:string;url?:string}
export interface StaticWorldManifest {
 version:1;
 archive:{name:string;bytes:number;sha256:string;directory:{file:string;bytes:number;sha256:string}};
 chunks:{file:string;bytes:number;expandedBytes:number;sha256:string}[];
 ranges:{offset:number;length:number;chunk:number;start:number}[];
 resources:StaticWorldResource[];
}
const LIMIT=64*1024*1024;
function safePath(path:string){return typeof path==='string'&&/^[a-zA-Z0-9_./-]+$/.test(path)&&!path.startsWith('/')&&!path.split('/').some(p=>p==='..'||p==='');}
function validateResource(resource:{bytes:number;sha256:string}){requireAsset(Number.isSafeInteger(resource.bytes)&&resource.bytes>0&&resource.bytes<=LIMIT&&/^[a-f0-9]{64}$/.test(resource.sha256),'Invalid static world resource.');}
async function collect(stream:ReadableStream<Uint8Array>,limit:number){
 const reader=stream.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;requireAsset(size<=limit,'Static world resource exceeds its byte limit.');chunks.push(value);}}
 catch(error){await reader.cancel();throw error;}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
async function fetchWorldResource(url:URL,signal?:AbortSignal){
 for(let attempt=0;;attempt++){
  signal?.throwIfAborted();
  try{
   const response=await fetch(url,{signal});
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
export async function fetchStaticWorldBytes(url:URL,resource:{bytes:number;sha256:string},signal?:AbortSignal){
 validateResource(resource);const response=await fetchWorldResource(url,signal);requireAsset(response.ok&&response.body,`World content download failed: ${url.pathname}`);
 const bytes=await collect(response.body!,resource.bytes);requireAsset(bytes.length===resource.bytes,'Incomplete static world resource.');
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 requireAsset(digest===resource.sha256,`World content checksum mismatch: ${url.pathname}`);return bytes;
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
 override slice(start=0,end=this.size,type=''){return new ArchiveSlice(0,this.size,this.read).slice(start,end,type);}
 override arrayBuffer(){return this.slice().arrayBuffer();}
 override bytes(){return this.slice().bytes();}
 override text(){return this.slice().text();}
 override stream(){return this.slice().stream();}
}
/** Original IMG offsets backed by immutable same-origin gzip chunks, with bounded retained decoded data. */
export async function openStaticWorld(baseUrl:string,signal?:AbortSignal){
 const base=new URL(baseUrl,globalThis.location?.href);requireAsset(base.pathname.endsWith('/'),'Static world base URL must end with /.');
 const response=await fetchWorldResource(new URL('manifest.json',base),signal);requireAsset(response.ok&&response.body,'World manifest download failed.');
 const manifest=JSON.parse(new TextDecoder().decode(await collect(response.body!,16*1024*1024))) as StaticWorldManifest;
 requireAsset(manifest.version===1&&manifest.archive?.name==='gta3.img'&&Number.isSafeInteger(manifest.archive.bytes)&&manifest.archive.bytes>0&&manifest.archive.bytes<=2*1024*1024*1024,'Invalid static world archive.');
 requireAsset(Array.isArray(manifest.chunks)&&manifest.chunks.length>0&&manifest.chunks.length<=4096&&Array.isArray(manifest.ranges)&&manifest.ranges.length<=200000&&Array.isArray(manifest.resources)&&manifest.resources.length<=2048,'Invalid world content inventory.');
 const directorySpec=manifest.archive.directory;validateResource(directorySpec);requireAsset(safePath(directorySpec.file),'Invalid archive directory path.');
 const paths=new Set<string>();
 for(const chunk of manifest.chunks){validateResource(chunk);requireAsset(safePath(chunk.file)&&!paths.has(chunk.file)&&Number.isSafeInteger(chunk.expandedBytes)&&chunk.expandedBytes>0&&chunk.expandedBytes<=LIMIT,'Invalid world chunk.');paths.add(chunk.file);}
 const byOffset=new Map<number,typeof manifest.ranges[number]>();let previousEnd=directorySpec.bytes;
 for(const range of manifest.ranges){const chunk=manifest.chunks[range.chunk];requireAsset([range.offset,range.length,range.chunk,range.start].every(Number.isSafeInteger)&&range.offset>=previousEnd&&range.length>0&&range.offset+range.length<=manifest.archive.bytes&&range.start>=0&&chunk&&range.start+range.length<=chunk.expandedBytes,'Invalid world entry range.');previousEnd=range.offset+range.length;byOffset.set(range.offset,range);}
 const resourceNames=new Set<string>();for(const resource of manifest.resources){validateResource(resource);requireAsset(safePath(resource.path)&&!resourceNames.has(resource.path.toLowerCase()),'Invalid or duplicate world resource path.');resourceNames.add(resource.path.toLowerCase());}
 const directory=await fetchStaticWorldBytes(new URL(directorySpec.file,base),directorySpec,signal);
 const cache=new Map<number,Uint8Array>(),pending=new Map<number,Promise<Uint8Array>>();let retainedBytes=0,downloads=0;
 async function chunkBytes(index:number){
  const cached=cache.get(index);if(cached){cache.delete(index);cache.set(index,cached);return cached;}
  const existing=pending.get(index);if(existing)return existing;
  const task=(async()=>{const spec=manifest.chunks[index],packed=await fetchStaticWorldBytes(new URL(spec.file,base),spec,signal);downloads++;
   const bytes=await collect(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip')),spec.expandedBytes);requireAsset(bytes.length===spec.expandedBytes,'Incomplete expanded world chunk.');
   while(retainedBytes+bytes.length>LIMIT&&cache.size){const [key,value]=cache.entries().next().value!;retainedBytes-=value.length;cache.delete(key);}
   cache.set(index,bytes);retainedBytes+=bytes.length;return bytes;
  })();pending.set(index,task);try{return await task;}finally{pending.delete(index);}
 }
 const file=new ArchiveFile(manifest.archive.bytes,async(from,to)=>{
  requireAsset(Number.isSafeInteger(from)&&Number.isSafeInteger(to)&&from>=0&&to>=from&&to<=manifest.archive.bytes&&to-from<=LIMIT,'Unsupported static archive read.');
  if(to<=directory.length)return directory.slice(from,to);
  const range=byOffset.get(from);requireAsset(range&&to===from+range.length,'Static archive reads must select one complete native entry.');
  const bytes=await chunkBytes(range!.chunk);return bytes.slice(range!.start,range!.start+range!.length);
 });
 const entries=await readImgIndex(file);requireAsset(entries.length===manifest.ranges.length&&entries.every(e=>byOffset.get(e.offset)?.length===e.length),'World archive directory and chunk inventory disagree.');
 return {file,entries,manifest,base,stats:()=>({downloads,retainedBytes,pending:pending.size}),
  async resource(resource:StaticWorldResource){requireAsset(manifest.resources.includes(resource),'Unknown world resource.');return new File([await fetchStaticWorldBytes(new URL('files/'+resource.path,base),resource,signal)],resource.path.split('/').at(-1)!);},
 };
}
