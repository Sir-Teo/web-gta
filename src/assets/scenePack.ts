/** Static scene packages preserve typed native buffers and local environment files. */
const arrays={Uint8Array,Uint8ClampedArray,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,Float32Array,Float64Array};
/** Uint8Array.fromBase64 where the browser has it: the start package's buffers took about 540 ms through
 * Uint8Array.from(atob(...)) with a per-character callback, and take about 6 ms this way. */
const nativeFromBase64=(Uint8Array as unknown as {fromBase64?:(text:string)=>Uint8Array<ArrayBuffer>}).fromBase64;
function fromBase64(text:string){
 if(nativeFromBase64)return nativeFromBase64.call(Uint8Array,text);
 const binary=atob(text),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return bytes;
}
/** Version 2 (inside the gzip stream): MAGIC, a little-endian u32 byte length of the JSON {version:2, buffers:
 * [[offset, length], ...], scene}, the JSON, then the buffers themselves, offsets counted from the JSON's end.
 * Version 1 was the JSON alone with every buffer as a base64 string: the start package took 1.5 MB more gzip and
 * parsed a 24 MB JSON document to get at 17.5 MB of buffers. */
const MAGIC=[0x57,0x47,0x53,0x50];// "WGSP"
/** The uncompressed version 2 package: `scene` refers to `buffers` by index ({$native, buffer, ...}). */
export function encodeScenePack(scene:unknown,buffers:readonly Uint8Array[]){
 const table:[number,number][]=[];let offset=0;for(const buffer of buffers){table.push([offset,buffer.length]);offset+=buffer.length;}
 const json=new TextEncoder().encode(JSON.stringify({version:2,buffers:table,scene}));
 const bytes=new Uint8Array(8+json.length+offset);bytes.set(MAGIC);new DataView(bytes.buffer).setUint32(4,json.length,true);bytes.set(json,8);
 let at=8+json.length;for(const buffer of buffers){bytes.set(buffer,at);at+=buffer.length;}
 return bytes;
}
function decodeScenePack(bytes:Uint8Array<ArrayBuffer>):{scene:unknown;buffers:Uint8Array<ArrayBuffer>[]}{
 if(MAGIC.every((b,i)=>bytes[i]===b)){
  const length=new DataView(bytes.buffer,bytes.byteOffset).getUint32(4,true),body=8+length;
  if(body>bytes.length)throw new Error('Truncated scene package.');
  const pack=JSON.parse(new TextDecoder().decode(bytes.subarray(8,body)));
  if(pack.version!==2||!Array.isArray(pack.buffers))throw new Error('Unsupported scene package.');
  // Each buffer gets its own ArrayBuffer, as version 1's did: typed views start at offset 0 of theirs, and one
  // retained view must not keep the whole package alive.
  const buffers=pack.buffers.map(([offset,size]:[number,number])=>{if(!(offset>=0&&size>=0&&body+offset+size<=bytes.length))throw new Error('Invalid scene buffer.');return bytes.slice(body+offset,body+offset+size);});
  return {scene:pack.scene,buffers:buffers as Uint8Array<ArrayBuffer>[]};
 }
 const pack=JSON.parse(new TextDecoder().decode(bytes));
 if(pack.version!==1||!Array.isArray(pack.buffers))throw new Error('Unsupported scene package.');
 return {scene:pack.scene,buffers:(pack.buffers as string[]).map(fromBase64)};
}
/** `early`: a request for the same URL already on its way (index.html starts the bundled one with the page). */
/** `onProgress` hears the package's bytes as they arrive, against the download's length when the server gives it. */
export async function readScenePack(url:string,early?:Promise<Response>,onProgress?:(received:number,total:number|undefined)=>void){
 const response=await (early??fetch(url));if(!response.ok)throw new Error(`Scene download failed (${response.status}).`);
 if(!response.body)throw new Error('Scene download is empty.');
 const length=Number(response.headers.get('content-length')),total=Number.isFinite(length)&&length>0&&!response.headers.get('content-encoding')?length:undefined;
 let received=0;
 const counted=onProgress?response.body.pipeThrough(new TransformStream<Uint8Array<ArrayBuffer>,Uint8Array<ArrayBuffer>>({transform(chunk,out){received+=chunk.byteLength;onProgress(received,total);out.enqueue(chunk);}})):response.body;
 const reader=counted.pipeThrough(new DecompressionStream('gzip')).getReader();
 const chunks:Uint8Array[]=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>256*1024*1024){await reader.cancel();throw new Error('Scene package exceeds its memory limit.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const {scene,buffers}=decodeScenePack(bytes);
 function decode(value:any):any{
  if(!value||typeof value!=='object')return value;
  if(value.$native){
   const raw=buffers[value.buffer];if(!raw)throw new Error('Missing scene buffer.');
   if(value.$native==='File')return new File([raw],value.name,{type:value.type});
   const ArrayType=arrays[value.$native as keyof typeof arrays];if(!ArrayType)throw new Error('Unsupported scene buffer.');
   return new ArrayType(raw.buffer,value.offset,value.length/ArrayType.BYTES_PER_ELEMENT);
  }
  if(Array.isArray(value))return value.map(decode);
  return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,decode(item)]));
 }
 return decode(scene);
}
