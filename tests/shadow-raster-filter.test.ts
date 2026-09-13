import {expect,test} from 'vitest';
import {DataTexture,LinearFilter,SRGBColorSpace} from 'three';
import {ShadowRasterFilter} from '../src/render/ShadowRasterFilter';
test('shadow filter rejects invalid inputs and feedback before touching the renderer',()=>{
 const filter=new ShadowRasterFilter(8),input=new DataTexture(new Uint8Array(16*16*4),16,16);input.minFilter=input.magFilter=LinearFilter;
 for(const passes of [-1,.5,17,NaN])expect(()=>filter.update(null as any,input,passes)).toThrow('pass count');
 expect(()=>filter.update(null as any,input,0,1 as any)).toThrow('gradient');
 expect(()=>filter.update(null as any,filter.texture,0)).toThrow('own output');
 input.colorSpace=SRGBColorSpace;expect(()=>filter.update(null as any,input,0)).toThrow('intensity raster');
 filter.dispose();input.dispose();
});
test('filter disposal is idempotent and does not dispose borrowed textures',()=>{
 const filter=new ShadowRasterFilter(),input=new DataTexture();let target=0,borrowed=0;
 filter.target.addEventListener('dispose',()=>target++);input.addEventListener('dispose',()=>borrowed++);
 filter.dispose();filter.dispose();expect(target).toBe(1);expect(borrowed).toBe(0);expect(()=>filter.update(null as any,input,0)).toThrow('disposed');input.dispose();
 for(const size of [0,7,9,1024,NaN])expect(()=>new ShadowRasterFilter(size)).toThrow('size');
});
