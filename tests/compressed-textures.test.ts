import {test,expect,afterEach} from 'vitest';
import * as THREE from 'three';
import {readTxd,decodeTexture} from '../src/assets/txd';
import {decodeNamedTextures,TextureDecodeCache} from '../src/assets/modelTextures';
import {nativeTexture,setCompressedTextureSupport} from '../src/assets/nativeTexture';
import {textureFixture,txdFixture} from './fixtures/native-assets';

// Red over green in a four-colour DXT1 block, then a zero-byte 2×2 and 1×1 tail.
const block=new Uint8Array([0,248,224,7,80,80,80,80]);
const dictionary=()=>txdFixture(textureFixture({width:4,height:4,format:0x31545844,mips:[block,new Uint8Array(),new Uint8Array()]}));
afterEach(()=>setCompressedTextureSupport(false));

test('a compressed decode cache keeps the stored DXT blocks and ends the chain before an absent level',()=>{
 const bytes=dictionary(),[texture]=decodeNamedTextures(['calibration_grid'],bytes,new TextureDecodeCache(true));
 expect(texture.compressed).toBe('DXT1');expect(texture.droppedMips).toEqual([1,2]);expect(texture.reconstructedMips).toBeUndefined();
 expect(texture.mips).toHaveLength(1);expect([...texture.mips[0].data]).toEqual([...block]);
 // The blocks are copied out, so transferring them never detaches the dictionary.
 expect(texture.mips[0].data.buffer).not.toBe(bytes.buffer);
 // Without the flag the chain is decoded and the tail rebuilt as before.
 const [decoded]=decodeNamedTextures(['calibration_grid'],bytes);
 expect(decoded.compressed).toBeUndefined();expect(decoded.mips).toHaveLength(3);expect(decoded.reconstructedMips).toEqual([1,2]);
});

test('compressed rasters upload as S3TC when the context has it, and DXT1 decodes to 16-bit 5551 otherwise',()=>{
 const [texture]=decodeNamedTextures(['calibration_grid'],dictionary(),new TextureDecodeCache(true));
 // A phone's GPU without S3TC: the RGBA decode narrowed to five bits a channel and its one-bit alpha, two bytes a texel.
 const fallback=nativeTexture(texture) as THREE.DataTexture;
 expect(fallback.isDataTexture).toBe(true);expect(fallback.format).toBe(THREE.RGBAFormat);expect(fallback.type).toBe(THREE.UnsignedShort5551Type);expect(fallback.unpackAlignment).toBe(2);
 const pixels=decodeTexture(readTxd(dictionary())[0],0),five=(v:number)=>Math.round(v*31/255);
 expect([...fallback.image.data!]).toEqual(Array.from({length:16},(_,i)=>pixels[i*4+3]?five(pixels[i*4])<<11|five(pixels[i*4+1])<<6|five(pixels[i*4+2])<<1|1:0));
 expect(fallback.mipmaps.map(m=>m.data.length)).toEqual([16]);
 setCompressedTextureSupport(true);
 const compressed=nativeTexture(texture) as THREE.CompressedTexture;
 expect(compressed.isCompressedTexture).toBe(true);expect(compressed.format).toBe(THREE.RGBA_S3TC_DXT1_Format);
 expect(compressed.mipmaps).toBe(texture.mips);expect(compressed.flipY).toBe(false);expect(compressed.generateMipmaps).toBe(false);
 // Uncompressed rasters keep the RGBA path.
 const [rgba]=decodeNamedTextures(['calibration_grid'],txdFixture(textureFixture({width:2,height:2,format:21,mips:[new Uint8Array(16)]})),new TextureDecodeCache(true));
 expect(rgba.compressed).toBeUndefined();expect((nativeTexture(rgba) as THREE.DataTexture).isDataTexture).toBe(true);
});
