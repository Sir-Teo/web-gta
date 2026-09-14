import {test,expect} from 'vitest';
import {openAsBlob} from 'node:fs';
import {writeFile,mkdir} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {readImgIndex,readImgEntry} from '../src/assets/img';
import {readTxd,decodeTexture} from '../src/assets/txd';
function crc(bytes:Uint8Array){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type:string,data:Buffer){const body=Buffer.concat([Buffer.from(type),data]),out=Buffer.alloc(body.length+8);out.writeUInt32BE(data.length);body.copy(out,4);out.writeUInt32BE(crc(body),body.length+4);return out;}
test.skipIf(!process.env.GTA_BUILD_RADAR)('extract all original radar tiles into one lossless map',async()=>{
 const archive=await openAsBlob(`${process.env.GTA_CONTENT_DIR}/gta3.img`),entries=await readImgIndex(archive);let size=0,pixels:Buffer|undefined;const sources=[];
 for(let i=0;i<144;i++){
  const name=`radar${String(i).padStart(2,'0')}`,entry=entries.find(e=>e.name===name+'.txd');expect(entry).toBeDefined();
  const raw=await readImgEntry(archive,entry!),texture=readTxd(raw).find(t=>t.name===name)!;expect(texture).toBeDefined();expect(texture.height).toBe(texture.width);
  if(!pixels){size=texture.width;pixels=Buffer.alloc(size*size*144*4);}expect(texture.width).toBe(size);
  const rgba=decodeTexture(texture),width=size*12;
  for(let y=0;y<size;y++)pixels.set(rgba.subarray(y*size*4,(y+1)*size*4),((Math.floor(i/12)*size+y)*width+i%12*size)*4);
  sources.push({name:entry!.name,sha256:createHash('sha256').update(raw).digest('hex')});
 }
 const width=size*12,rows=Buffer.alloc((width*4+1)*width);for(let y=0;y<width;y++)pixels!.copy(rows,y*(width*4+1)+1,y*width*4,(y+1)*width*4);
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(width,4);header[8]=8;header[9]=6;
 const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
 await mkdir('public/play/navigation',{recursive:true});await writeFile('public/play/navigation/san-andreas.png',png);
 await writeFile('public/play/navigation/provenance.json',JSON.stringify({source:'gta3.img',layout:'Radar.cpp TransformRealWorldToTexCoordSpace; 12x12 tiles, 500 world units per tile, north up',width,height:width,sha256:createHash('sha256').update(png).digest('hex'),tiles:sources},null,2)+'\n');
});
