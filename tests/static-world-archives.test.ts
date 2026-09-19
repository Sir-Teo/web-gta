import {expect,test} from 'vitest';
import {combineImgs} from '../src/assets/staticWorldArchive';
import {readImgIndex,readImgEntry} from '../src/assets/img';

/** A VER2 IMG in memory: each entry one sector filled with its index. */
function img(names:string[],firstSector=1){
 const bytes=new Uint8Array((firstSector+names.length)*2048),view=new DataView(bytes.buffer);
 bytes.set([86,69,82,50]);view.setUint32(4,names.length,true);
 names.forEach((name,i)=>{const at=8+i*32;view.setUint32(at,firstSector+i,true);view.setUint16(at+4,1,true);for(let c=0;c<name.length;c++)bytes[at+8+c]=name.charCodeAt(c);bytes.fill(i+1+names.length*10,(firstSector+i)*2048,(firstSector+i+1)*2048);});
 return bytes;
}
const blob=(size:number,read:(a:number,b:number)=>Promise<Uint8Array>)=>({size,slice:(a:number,b:number)=>({arrayBuffer:async()=>(await read(a,b)).slice().buffer})}) as unknown as Blob;
const source=(bytes:Uint8Array)=>blob(bytes.length,async(a,b)=>bytes.slice(a,b));

test('CStreaming opens gta_int.img after gta3.img: one virtual directory, the first IMG keeping duplicate names',async()=>{
 const a=img(['a.dff','shared.txd','b.col']),b=img(['int.dff','SHARED.txd','int_la_stream0.ipl']);
 const images=await Promise.all([a,b].map(async bytes=>({entries:await readImgIndex(source(bytes)),bytes:bytes.length,read:async(from:number,to:number)=>bytes.slice(from,to)})));
 const combined=combineImgs(images),file=blob(combined.size,combined.read),entries=await readImgIndex(file);
 expect(entries.map(e=>e.name)).toEqual(['a.dff','shared.txd','b.col','int.dff','int_la_stream0.ipl']);
 // Entry bytes come through unchanged from the image that owns them.
 const shared=await readImgEntry(file,entries[1]);expect(shared[0]).toBe(2+30);
 const stream=await readImgEntry(file,entries[4]);expect(stream[0]).toBe(3+30);
 // The combined directory sits before every shifted entry, and reads must still select whole entries.
 expect(Math.min(...entries.map(e=>e.offset))).toBeGreaterThanOrEqual(2048);
 await expect(combined.read(entries[0].offset,entries[0].offset+10)).rejects.toThrow('complete native entry');
});
