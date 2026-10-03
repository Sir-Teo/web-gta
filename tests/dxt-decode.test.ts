import {expect,test} from 'vitest';
import {decodeDxt,decodeDxt1To5551,type DxtFormat} from '../src/assets/dxt';

/** The decoder as it was, a block's colours as arrays: the reference the allocation-free one must match. */
function reference(bytes:Uint8Array,width:number,height:number,format:DxtFormat){
 const rgb565=(value:number)=>{const r=value>>>11,g=(value>>>5)&63,b=value&31;return [(r<<3)|(r>>>2),(g<<2)|(g>>>4),(b<<3)|(b>>>2),255];};
 const blockSize=format==='DXT1'?8:16,blocksX=Math.ceil(width/4),blocksY=Math.ceil(height/4);
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),rgba=new Uint8ClampedArray(width*height*4);
 for(let by=0;by<blocksY;by++)for(let bx=0;bx<blocksX;bx++){
  const offset=(by*blocksX+bx)*blockSize,color=offset+(format==='DXT1'?0:8);
  const c0=view.getUint16(color,true),c1=view.getUint16(color+2,true),colors=[rgb565(c0),rgb565(c1)];
  const fourColors=format!=='DXT1'||c0>c1;
  colors.push(colors[0].map((v,c)=>c===3?255:Math.floor(fourColors?(2*v+colors[1][c])/3:(v+colors[1][c])/2)));
  colors.push(fourColors?colors[0].map((v,c)=>c===3?255:Math.floor((v+2*colors[1][c])/3)):[0,0,0,0]);
  const indices=view.getUint32(color+4,true),alphas=[bytes[offset],bytes[offset+1]];
  if(format==='DXT5'){const interpolated=alphas[0]>alphas[1]?6:4;
   for(let i=1;i<=interpolated;i++)alphas.push(Math.floor(((interpolated+1-i)*alphas[0]+i*alphas[1])/(interpolated+1)));
   if(interpolated===4)alphas.push(0,255);}
  for(let pixel=0;pixel<16;pixel++){
   const x=bx*4+pixel%4,y=by*4+Math.floor(pixel/4);if(x>=width||y>=height)continue;
   const dest=(y*width+x)*4;rgba.set(colors[(indices>>>(pixel*2))&3],dest);
   if(format==='DXT3')rgba[dest+3]=((bytes[offset+(pixel>>>1)]>>>((pixel&1)*4))&15)*17;
   if(format==='DXT5'){const bit=pixel*3,byte=offset+2+(bit>>>3),shift=bit&7;rgba[dest+3]=alphas[((bytes[byte]|(bytes[byte+1]??0)<<8)>>>shift)&7];}
  }
 }
 return rgba;
}
/** A seeded stream of bytes, so a failure repeats. */
function random(seed:number){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed>>>24;};}
const blocksFor=(width:number,height:number,format:DxtFormat,next:()=>number)=>Uint8Array.from({length:Math.ceil(width/4)*Math.ceil(height/4)*(format==='DXT1'?8:16)},next);

test('the decoder gives the same pixels as before, block for block, for every format and odd sizes',()=>{
 const next=random(7);
 for(const format of ['DXT1','DXT3','DXT5'] as const)for(const [w,h] of [[4,4],[16,8],[1,1],[2,2],[1,8],[13,7],[64,32]]){
  const bytes=blocksFor(w,h,format,next);expect(decodeDxt(bytes,w,h,format)).toEqual(reference(bytes,w,h,format));
 }
});

test('a DXT1 raster in 16 bits is its RGBA narrowed to 5551: the one-bit alpha kept, transparent black as zero',()=>{
 const next=random(11);
 for(const [w,h] of [[4,4],[32,32],[1,1],[2,1],[1,2],[9,5]]){
  const bytes=blocksFor(w,h,'DXT1',next),rgba=decodeDxt(bytes,w,h,'DXT1'),packed=decodeDxt1To5551(bytes,w,h);
  expect(packed).toHaveLength(w*h);
  for(let i=0;i<w*h;i++){
   const [r,g,b,a]=rgba.subarray(i*4,i*4+4),five=(v:number)=>Math.round(v*31/255);
   expect(packed[i]).toBe(a?five(r)<<11|five(g)<<6|five(b)<<1|1:0);
   if(!a)expect([r,g,b]).toEqual([0,0,0]);
  }
 }
 // The ends of a block's colour line are exact at five bits: white and pure red, opaque.
 const block=Uint8Array.of(0xff,0xff,0x00,0xf8,0b11100100,0,0,0);
 const ends=decodeDxt1To5551(block,4,1);expect([ends[0],ends[1]]).toEqual([0xffff,0xf801]);
 expect(() => decodeDxt1To5551(block.slice(0,7),4,4)).toThrow('mip');
});
