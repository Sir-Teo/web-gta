import {requireAsset} from './binary';
import {readDff,type DffModel} from './dff';
import {readImgEntry,type ImgEntry} from './img';
/** Account unique backing buffers plus an estimate for decoded metadata.
 * This is a residency budget, not a measurement of the JS engine's heap. */
export function modelGeometryBytes(model:DffModel){
 const seen=new Set<object>();
 const count=(value:unknown):number=>{
  if(typeof value==='string')return value.length*2;
  if(typeof value==='number'||typeof value==='boolean')return 8;
  if(value===null||typeof value!=='object'||seen.has(value))return 0;
  seen.add(value);
  if(ArrayBuffer.isView(value)){if(seen.has(value.buffer))return 0;seen.add(value.buffer);return value.buffer.byteLength;}
  return 64+Object.values(value).reduce<number>((sum,v)=>sum+count(v),0);
 };
 return count(model);
}
/** Worker-owned immutable geometry, scoped to one archive selection. No textures,
 * placement state, or GPU resources are retained here. */
export class ModelGeometryCache {
 private entries=new Map<string,{model:DffModel;bytes:number}>();
 private pending=new Map<string,Promise<DffModel>>();
 private files=new WeakMap<File,number>();private nextFile=0;
 private retainedBytes=0;private hits=0;private decodes=0;private evictions=0;
 constructor(readonly file:File,readonly limit=32*1024*1024){requireAsset(Number.isSafeInteger(limit)&&limit>0&&limit<=128*1024*1024,'Invalid model geometry cache budget.');}
 async read(entry?:ImgEntry,modelFile?:File,clumpIndex?:number){
  const source=modelFile??(!entry?this.file:undefined);
  let key:string;
  if(source){let id=this.files.get(source);if(id===undefined){id=++this.nextFile;this.files.set(source,id);}key=`file:${id}`;}
  else key=`img:${entry!.offset}:${entry!.length}`;
  key+=`:${clumpIndex??'default'}`;
  const cached=this.entries.get(key);
  if(cached){this.hits++;this.entries.delete(key);this.entries.set(key,cached);return cached.model;}
  const pending=this.pending.get(key);if(pending){this.hits++;return pending;}
  const load=(async()=>{
   const bytes=source?new Uint8Array(await source.arrayBuffer()):await readImgEntry(this.file,entry!);
   const model=readDff(bytes,clumpIndex);this.decodes++;
   const size=modelGeometryBytes(model);
   if(size<=this.limit){
    while(this.retainedBytes+size>this.limit){const [oldKey,old]=this.entries.entries().next().value!;this.entries.delete(oldKey);this.retainedBytes-=old.bytes;this.evictions++;}
    this.entries.set(key,{model,bytes:size});this.retainedBytes+=size;
   }
   return model;
  })();
  this.pending.set(key,load);
  try{return await load;}finally{this.pending.delete(key);}
 }
 stats(){return {hits:this.hits,decodes:this.decodes,evictions:this.evictions,models:this.entries.size,retainedBytes:this.retainedBytes,limit:this.limit,pending:this.pending.size};}
}
