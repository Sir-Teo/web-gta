import {requireAsset} from '../assets/binary';
import type {ScmParameter} from '../assets/scm';

const decoder=new TextDecoder('windows-1252');
const encoding=new Map(Array.from({length:256},(_,byte)=>[decoder.decode(new Uint8Array([byte])),byte]));

/** Bounded byte strings in ScriptSpace / local 32-bit slots. String arrays
 * stride 8 or 16 bytes, independent of their descriptor's advisory count. */
export class ScmStrings {
 constructor(private globals:DataView,private locals:DataView){}
 private storage(p:ScmParameter){
  const short=[10,11,12,13].includes(p.type),long=[16,17,18,19].includes(p.type);
  requireAsset(short||long,'Unsupported SCM string variable.');
  const width=short?8:16,global=p.type%2===0,view=global?this.globals:this.locals;
  let offset:number;
  if([12,13,18,19].includes(p.type)){
   requireAsset(Array.isArray(p.value)&&p.value.length===6,'Invalid SCM string array.');
   const d=p.value as number[],base=d[0]|d[1]<<8,indexVariable=d[2]|d[3]<<8;
   const indexView=d[5]&128?this.globals:this.locals,indexOffset=d[5]&128?indexVariable:indexVariable*4;
   requireAsset(indexOffset+4<=indexView.byteLength,'SCM string array index out of bounds.');
   offset=(global?base:base*4)+indexView.getInt32(indexOffset,true)*width;
  }else{
   requireAsset(typeof p.value==='number','Invalid SCM string variable.');offset=(p.value as number)*(global?1:4);
  }
  requireAsset(Number.isInteger(offset)&&offset>=0&&offset+width<=view.byteLength,'SCM string address out of bounds.');
  return new Uint8Array(view.buffer,view.byteOffset+offset,width);
 }
 bytes(p:ScmParameter){
  if([9,14,15].includes(p.type)){
   requireAsset(typeof p.value==='string','Invalid SCM text literal.');
   const value=p.value as string,width=p.type===9?8:p.type===15?16:value.length;
   requireAsset(value.length<=width&&(p.type!==14||width<=255),'Invalid SCM text literal length.');
   const result=new Uint8Array(width);
   for(let i=0;i<value.length;i++){const byte=encoding.get(value[i]);requireAsset(byte!==undefined,'Invalid SCM text encoding.');result[i]=byte;}
   return result;
  }
  return this.storage(p);
 }
 text(p:ScmParameter){const bytes=this.bytes(p),zero=bytes.indexOf(0);return decoder.decode(p.type===14||zero<0?bytes:bytes.subarray(0,zero));}
 assign(destination:ScmParameter,source:ScmParameter,width:8|16){
  const dst=this.storage(destination),src=this.bytes(source).slice();
  requireAsset(dst.length>=width,'SCM text destination is too small.');
  // strncpy pads after the first NUL and need not terminate a full-width label.
  const zero=src.indexOf(0),count=Math.min(width,zero<0?src.length:zero);
  dst.fill(0,0,width);dst.set(src.subarray(0,count));
 }
}
