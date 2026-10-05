/** War Drum's texture database, as the iOS port reads it (texdb/<name>/<name>.pvr.{toc,dat} and <name>.txt).
 *
 * Read from the arm64 slice of the port's executable (gta3sa.app): the entry reader at 0x10012d388, its run-length
 * decoder at 0x10012f3f0 and the size helpers after it.
 *  - `.toc`: a u32 (the `.dat` file's size), then a u32 offset into `.dat` per texture, in `.txt`'s order.
 *  - `.dat` entry: u16 id, u16 GL pixel type (0x8033 GL_UNSIGNED_SHORT_4_4_4_4, 0x8363 GL_UNSIGNED_SHORT_5_6_5, ...),
 *    u16 width, u16 height whose bit 15 marks a mip chain, u32 payload size, then the payload.
 *  - payload: a u32 marker, then a run-length stream of elements (4 bytes for the 16-bit types, the decoder's element
 *    size by type): [marker][count][element] is `count` copies of the element, anything else one element as it is. A
 *    marker of 0 means the payload is the pixels as they are. The decoded bytes are every level, largest first, until
 *    width + height comes to 2 or less, each level halved down to 1 (2 bytes a pixel for the 16-bit types). */
import {deflateSync} from 'node:zlib';
export const GL={rgba4444:0x8033,rgba5551:0x8034,rgb565:0x8363};
/** The decoder's element size for a pixel type (arm64 0x10012f758): the compressed block types' blocks, else 4. */
export function elementSize(type){
 if(type<=0x8bff){if(type===0x83f0||type===0x83f1)return 8;if(type===0x83f2||type===0x83f3)return 16;return 4;}
 return type===0x8d64?8:4;
}
/** A level's bytes (arm64 0x10012f5c4) for the 16-bit types, which are all this database holds. */
export function levelBytes(width,height,type,level){
 const w=Math.max(1,width>>level),h=Math.max(1,height>>level);
 if(type===GL.rgba4444||type===GL.rgba5551||type===GL.rgb565)return w*h*2;
 throw new Error(`Pixel type 0x${type.toString(16)} is not a 16-bit one.`);
}
/** How many levels an entry has (arm64 0x10012f568). */
export function levelCount(width,height,mipmapped){
 if(!mipmapped||width+height<3)return 1;
 let n=1,w=width,h=height;
 do{w=Math.max(1,w>>1);h=Math.max(1,h>>1);n++;}while(w+h>2);
 return n;
}
/** The run-length decoder (arm64 0x10012f3f0): fills `size` bytes from `src` at `at`; returns them and where it stopped. */
export function runLengthDecode(src,at,size,element,marker){
 const out=new Uint8Array(Math.ceil(size/element)*element);let dst=0;
 while(dst<size){
  if(src[at]===marker){const count=src[at+1];for(let k=0;k<count;k++){out.set(src.subarray(at+2,at+2+element),dst);dst+=element;}at+=element+2;}
  else{out.set(src.subarray(at,at+element),dst);dst+=element;at+=element;}
 }
 return {bytes:out.subarray(0,size),end:at};
}
/** The entries of a database, named from its `.txt`; each with its first level as 8-bit RGBA. */
export function readTextureDatabase(toc,dat,txt){
 const names=txt.split(/\r?\n/).filter(line=>line.startsWith('"')).map(line=>{
  const m=line.match(/^"([^"]+)"\s+width=(\d+)\s+height=(\d+)/);if(!m)throw new Error(`Unreadable texture line: ${line}`);
  return {name:m[1],width:+m[2],height:+m[3]};
 });
 const view=new DataView(dat.buffer,dat.byteOffset,dat.byteLength),tocView=new DataView(toc.buffer,toc.byteOffset,toc.byteLength);
 if(tocView.getUint32(0,true)!==dat.length)throw new Error('The .toc does not give the .dat its size.');
 const count=(toc.length-4)/4;if(count!==names.length)throw new Error(`The .toc has ${count} textures, the .txt ${names.length}.`);
 return names.map((named,i)=>{
  const at=tocView.getUint32(4+i*4,true),type=view.getUint16(at+2,true),width=view.getUint16(at+4,true),rawHeight=view.getUint16(at+6,true);
  const height=rawHeight&0x7fff,payload=view.getUint32(at+8,true),marker=view.getUint32(at+12,true);
  if(width!==named.width||height!==named.height)throw new Error(`${named.name} is ${width}x${height} in the .dat, ${named.width}x${named.height} in the .txt.`);
  const levels=levelCount(width,height,(rawHeight&0x8000)!==0);let size=0;for(let l=0;l<levels;l++)size+=levelBytes(width,height,type,l);
  let bytes;
  if(marker){const decoded=runLengthDecode(dat,at+16,size,elementSize(type),marker);if(decoded.end!==at+12+payload)throw new Error(`${named.name}'s stream ends at ${decoded.end-at-12} of ${payload} bytes.`);bytes=decoded.bytes;}
  else bytes=dat.subarray(at+12,at+12+size);
  return {name:named.name,id:view.getUint16(at,true),type,width,height,levels,rgba:toRgba(type,width,height,bytes)};
 });
}
/** The first level as 8-bit RGBA: GL's 16-bit types keep their first component in the high bits. */
export function toRgba(type,width,height,bytes){
 const out=new Uint8Array(width*height*4),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 for(let p=0;p<width*height;p++){
  const v=view.getUint16(p*2,true),o=p*4;
  if(type===GL.rgba4444){out[o]=(v>>12&15)*17;out[o+1]=(v>>8&15)*17;out[o+2]=(v>>4&15)*17;out[o+3]=(v&15)*17;}
  else if(type===GL.rgba5551){out[o]=Math.round((v>>11&31)*255/31);out[o+1]=Math.round((v>>6&31)*255/31);out[o+2]=Math.round((v>>1&31)*255/31);out[o+3]=v&1?255:0;}
  else if(type===GL.rgb565){out[o]=Math.round((v>>11&31)*255/31);out[o+1]=Math.round((v>>5&63)*255/63);out[o+2]=Math.round((v&31)*255/31);out[o+3]=255;}
  else throw new Error(`Pixel type 0x${type.toString(16)} is not a 16-bit one.`);
 }
 return out;
}
const CRC_TABLE=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^c>>>1:c>>>1;return c>>>0;});
const crc32=bytes=>{let c=0xffffffff;for(const b of bytes)c=CRC_TABLE[(c^b)&255]^c>>>8;return (c^0xffffffff)>>>0;};
/** An RGBA PNG. */
export function encodePng(width,height,rgba){
 const rows=Buffer.alloc((width*4+1)*height);
 for(let y=0;y<height;y++)Buffer.from(rgba.buffer,rgba.byteOffset+y*width*4,width*4).copy(rows,y*(width*4+1)+1);
 const chunk=(type,data)=>{const head=Buffer.alloc(8);head.writeUInt32BE(data.length);head.write(type,4,'latin1');const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4),data])));return Buffer.concat([head,data,crc]);};
 const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
