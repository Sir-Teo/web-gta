import {expect,test} from 'vitest';
import {ClampToEdgeWrapping,LinearFilter,NoColorSpace} from 'three';
import {CharacterSilhouette} from '../src/render/CharacterSilhouette';
test('silhouette uses a bounded linear uncolored intensity raster without generated mip levels',()=>{
 for(const size of [0,15,100,2048,NaN])expect(()=>new CharacterSilhouette(size)).toThrow('size');
 const mask=new CharacterSilhouette();expect(mask.target.width).toBe(128);expect(mask.target.height).toBe(128);
 expect(mask.texture.colorSpace).toBe(NoColorSpace);expect(mask.texture.minFilter).toBe(LinearFilter);expect(mask.texture.magFilter).toBe(LinearFilter);
 expect(mask.texture.wrapS).toBe(ClampToEdgeWrapping);expect(mask.texture.wrapT).toBe(ClampToEdgeWrapping);expect(mask.texture.generateMipmaps).toBe(false);
 mask.dispose();
});
test('silhouette releases its target once and rejects updates after disposal before touching borrowed objects',()=>{
 const mask=new CharacterSilhouette();let disposed=0;mask.target.addEventListener('dispose',()=>disposed++);mask.dispose();mask.dispose();
 expect(disposed).toBe(1);expect(()=>mask.update(null as any,null as any,null as any)).toThrow('disposed');
});
