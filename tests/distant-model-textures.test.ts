import {test,expect} from 'vitest';
import {distantModelTextures} from '../src/assets/distantModelTextures';
import type {ModelTexture} from '../src/assets/modelTextures';
test('distant textures retain original mip pixels, sampling and provenance without mutating near textures',()=>{
 const texture:ModelTexture={sourceDictionary:'test.txd',name:'ground',filter:6,addressU:1,addressV:2,hasAlpha:true,reconstructedMips:[3],mips:[512,256,128,64].map(size=>({width:size,height:size,data:new Uint8ClampedArray(size*size*4)}))};
 const [distant]=distantModelTextures([texture]);expect(distant.mips).toHaveLength(2);expect(distant.mips[0]).toBe(texture.mips[2]);expect(distant.mips[1].data).toBe(texture.mips[3].data);expect(distant.reconstructedMips).toEqual([1]);
 expect(texture.mips).toHaveLength(4);expect(texture.reconstructedMips).toEqual([3]);expect(distant).toMatchObject({sourceDictionary:'test.txd',filter:6,addressU:1,addressV:2,hasAlpha:true});
 const single={...texture,mips:[texture.mips[0]]};expect(distantModelTextures([single])[0]).toBe(single);
});
