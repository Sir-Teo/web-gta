/** Static scene packages preserve typed native buffers and local environment files. */
const arrays={Uint8Array,Uint8ClampedArray,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,Float32Array,Float64Array};
/** Uint8Array.fromBase64 where the browser has it: the start package's buffers took about 540 ms through
 * Uint8Array.from(atob(...)) with a per-character callback, and take about 6 ms this way. */
const nativeFromBase64=(Uint8Array as unknown as {fromBase64?:(text:string)=>Uint8Array}).fromBase64;
function fromBase64(text:string){
 if(nativeFromBase64)return nativeFromBase64.call(Uint8Array,text);
 const binary=atob(text),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return bytes;
}
export async function readScenePack(url:string){
 const response=await fetch(url);if(!response.ok)throw new Error(`Scene download failed (${response.status}).`);
 if(!response.body)throw new Error('Scene download is empty.');
 const reader=response.body.pipeThrough(new DecompressionStream('gzip')).getReader();
 const chunks:Uint8Array[]=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>256*1024*1024){await reader.cancel();throw new Error('Scene package exceeds its memory limit.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const pack=JSON.parse(new TextDecoder().decode(bytes));
 if(pack.version!==1||!Array.isArray(pack.buffers))throw new Error('Unsupported scene package.');
 const buffers=pack.buffers.map(fromBase64);
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
 return decode(pack.scene);
}
