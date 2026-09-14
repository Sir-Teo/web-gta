import {test,expect} from 'vitest';
import {readTxd,decodeTexture} from '../src/assets/txd';
import {decodeNamedTextures} from '../src/assets/modelTextures';
import {textureFixture,txdFixture} from './fixtures/native-assets';
const block=new Uint8Array([0,248,224,7,80,80,80,80]);
test('public-world zero-byte tiny DXT tails reconstruct without modifying supplied pixels',()=>{
 const bytes=txdFixture(textureFixture({width:4,height:4,format:0x31545844,mips:[block,new Uint8Array(),new Uint8Array()]}));
 const [texture]=readTxd(bytes);expect(texture.mips[1].bytes).toHaveLength(0);
 expect([...decodeTexture(texture,0).slice(0,4)]).toEqual([255,0,0,255]);
 expect([...decodeTexture(texture,1).slice(4,8)]).toEqual([0,255,0,255]);
 expect([...decodeTexture(texture,2)]).toEqual([128,128,0,255]);
 expect(decodeNamedTextures(['calibration_grid'],bytes)[0].reconstructedMips).toEqual([1,2]);
});
test('empty base levels, large DXT levels and uncompressed tails remain invalid',()=>{
 for(const options of [{width:4,height:4,format:0x31545844,mips:[new Uint8Array()]},{width:8,height:8,format:0x31545844,mips:[new Uint8Array(32),new Uint8Array()]},{width:2,height:2,format:21,mips:[new Uint8Array(16),new Uint8Array()]}])expect(()=>readTxd(txdFixture(textureFixture(options)))).toThrow('Incorrect texture mip size');
});

test('rectangular DXT tails may be absent when either axis is smaller than a block',()=>{
 const [texture]=readTxd(txdFixture(textureFixture({width:8,height:4,format:0x31545844,mips:[new Uint8Array([...block,...block]),new Uint8Array()]})));
 const pixels=decodeTexture(texture,1);expect(pixels).toHaveLength(32);expect([...pixels.slice(0,4)]).toEqual([255,0,0,255]);
});
