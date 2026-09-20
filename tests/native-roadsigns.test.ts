import {expect,test} from 'vitest';
import {roadsignGlyphCell,roadsignLineRaster,roadsignLineOffsets,roadsignLineQuad,roadsignAlpha,ROADSIGN_PALETTE,SIGN_CHAR_WIDTH,SIGN_CHAR_HEIGHT} from '../src/world/nativeRoadsigns';
import {readTwoDEffects,roadsignNumLines,roadsignNumLetters,roadsignPalette,EFFECT} from '../src/assets/twoDEffect';
test('RoadsignGetLineAndRow: the charset column and row of each character, the blank cell for anything else',()=>{
 expect(roadsignGlyphCell('A')).toEqual({line:0,row:6});expect(roadsignGlyphCell('B')).toEqual({line:1,row:6});expect(roadsignGlyphCell('0')).toEqual({line:3,row:2});
 expect(roadsignGlyphCell('z')).toEqual({line:2,row:19});expect(roadsignGlyphCell('~')).toEqual({line:1,row:21});expect(roadsignGlyphCell('!')).toEqual({line:0,row:0});
 expect(roadsignGlyphCell('_')).toEqual({line:0,row:26});expect(roadsignGlyphCell(' ')).toEqual({line:0,row:26});expect(roadsignGlyphCell(String.fromCharCode(27))).toEqual({line:0,row:26});
});
test('RoadsignGenerateTextRaster copies each character cell of the 32 x 512 charset into an 8-per-letter strip',()=>{
 // A synthetic charset whose every pixel encodes its cell: red = column, green = row.
 const font={width:32,height:512,data:new Uint8ClampedArray(32*512*4)};
 for(let y=0;y<512;y++)for(let x=0;x<32;x++){const i=(y*32+x)*4;font.data[i]=Math.floor(x/8);font.data[i+1]=Math.floor(y/16);font.data[i+2]=x%8;font.data[i+3]=y%16;}
 const strip=roadsignLineRaster('AB_',4,font);
 expect(strip.width).toBe(32);expect(strip.height).toBe(16);
 const cell=(letter:number,x:number,y:number)=>{const i=(y*strip.width+letter*SIGN_CHAR_WIDTH+x)*4;return [strip.data[i],strip.data[i+1],strip.data[i+2],strip.data[i+3]];};
 expect(cell(0,0,0)).toEqual([0,6,0,0]);expect(cell(0,7,15)).toEqual([0,6,7,15]);expect(cell(1,3,4)).toEqual([1,6,3,4]);
 expect(cell(2,0,0)).toEqual([0,26,0,0]);expect(cell(3,5,9)).toEqual([0,26,5,9]);
 expect(()=>roadsignLineRaster('A',0,font)).toThrow();expect(()=>roadsignLineRaster('A',2,{width:16,height:512,data:new Uint8ClampedArray(16*512*4)})).toThrow();
 expect(SIGN_CHAR_HEIGHT).toBe(16);
});
test('CreateRoadsignAtomicA stacks the lines by count, each 0.95 of a line tall, over the sign width',()=>{
 expect(roadsignLineOffsets(2,1)).toEqual([-1]);expect(roadsignLineOffsets(2,2)).toEqual([0,-1]);
 expect(roadsignLineOffsets(3,3)).toEqual([.5,-.5,-1.5]);expect(roadsignLineOffsets(4,4)).toEqual([1,0,-1,-2]);
 const q=roadsignLineQuad(4,2.5,3,1);
 expect(q.positions.slice(0,3)).toEqual([-2,-.4166666666666667,0]);expect(q.positions.slice(3,6)).toEqual([2,-.4166666666666667,0]);
 expect(q.positions[7]).toBeCloseTo(-.4166666666666667+2.5/3*.95,6);expect(q.uvs).toEqual([0,1,1,1,1,0,0,0]);expect(q.indices).toEqual([0,1,2,0,2,3]);
 expect(ROADSIGN_PALETTE[3]).toEqual([255,0,0]);
});
test('RenderRoadsignAtomic keeps a sign opaque within 40 units and fades it to nothing at 500',()=>{
 expect(roadsignAlpha(10)).toBe(255);expect(roadsignAlpha(39.9)).toBe(255);expect(roadsignAlpha(40)).toBe(254);expect(roadsignAlpha(500)).toBe(0);expect(roadsignAlpha(501)).toBe(0);
 expect(roadsignAlpha(Math.sqrt((1600+250000)/2))).toBe(127);
});
test('the roadsign 2d effect reads its size, rotation, flag pairs and four text lines',()=>{
 const bytes=new Uint8Array(4+12+8+88),v=new DataView(bytes.buffer);let o=0;
 v.setUint32(o,1,true);o+=4;[1.5,-2,3].forEach(f=>{v.setFloat32(o,f,true);o+=4;});v.setUint32(o,EFFECT.roadsign,true);o+=4;v.setUint32(o,88,true);o+=4;
 [4,2.5].forEach(f=>{v.setFloat32(o,f,true);o+=4;});[90,0,-180].forEach(f=>{v.setFloat32(o,f,true);o+=4;});v.setUint16(o,3|2<<2|3<<4,true);o+=2;v.setUint16(o,0,true);o+=2;
 for(const line of ['Glen_Park','LS_Forum______>_','','X']){for(let i=0;i<16;i++)bytes[o++]=i<line.length?line.charCodeAt(i):0;}
 const [fx]=readTwoDEffects(bytes);
 expect(fx.position).toEqual([1.5,-2,3]);expect(fx.type).toBe(7);
 expect(fx.roadsign).toEqual({size:[4,2.5],rotation:[90,0,-180],flags:3|2<<2|3<<4,lines:['Glen_Park','LS_Forum______>_','','X']});
 expect(roadsignNumLines(fx.roadsign!.flags)).toBe(3);expect(roadsignNumLetters(fx.roadsign!.flags)).toBe(4);expect(roadsignPalette(fx.roadsign!.flags)).toBe(3);
 expect(roadsignNumLines(0)).toBe(4);expect(roadsignNumLetters(0)).toBe(16);expect(roadsignNumLetters(1<<2)).toBe(2);expect(roadsignNumLetters(3<<2)).toBe(8);expect(roadsignPalette(16)).toBe(1);expect(roadsignPalette(50)).toBe(3);
});
