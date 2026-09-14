import {expect,test} from 'vitest';
import {decodeSunTexture,decodeSkyTextures} from '../src/assets/sunTexture';
import {TextureDecodeCache,decodeNamedTextures} from '../src/assets/modelTextures';
import {textureFixture,txdFixture} from './fixtures/native-assets';

test('sun texture selection resolves coronastar by name and preserves mip and sampler metadata',()=>{
  const bytes=txdFixture(textureFixture({name:'coronamoon'}),textureFixture({name:'CORONASTAR'}));
  const texture=decodeSunTexture(bytes);
  expect(texture.name).toBe('CORONASTAR');expect(texture.mips.map(m=>[m.width,m.height])).toEqual([[64,64],[32,32]]);
  expect([...texture.mips[0].data.slice(0,4)]).toEqual([40,75,180,255]);
  expect(texture).toEqual(decodeNamedTextures(['CORONASTAR'],bytes)[0]);
});

test('missing and ambiguous sun rasters fail without substituting a different corona texture',()=>{
  expect(()=>decodeSunTexture(txdFixture(textureFixture({name:'coronamoon'})))).toThrow('no coronastar');
  expect(()=>decodeSunTexture(txdFixture(textureFixture({name:'coronastar'}),textureFixture({name:'CORONASTAR'})))).toThrow('duplicate');
});

test('sun texture cache retains source identity without conflating separate dictionaries',()=>{
  const cache=new TextureDecodeCache(),a=txdFixture(textureFixture({name:'coronastar'})),b=a.slice();
  const first=decodeSunTexture(a,cache);expect(decodeSunTexture(a,cache)).toBe(first);
  expect(decodeNamedTextures(['coronastar'],a,cache)[0]).toBe(first);expect(decodeSunTexture(b,cache)).not.toBe(first);
});

test('particle decoding optionally resolves cloud1 while keeping coronastar required',()=>{
 const both=decodeSkyTextures(txdFixture(textureFixture({name:'coronastar'}),textureFixture({name:'CLOUD1'})));
 expect(both.cloud!.name).toBe('CLOUD1');expect(both.texture.name).toBe('coronastar');
 expect(decodeSkyTextures(txdFixture(textureFixture({name:'coronastar'}))).cloud).toBeUndefined();
 expect(()=>decodeSkyTextures(txdFixture(textureFixture({name:'cloud1'})))).toThrow('no coronastar');
});
