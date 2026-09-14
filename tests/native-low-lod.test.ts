import {expect,test} from 'vitest';
import {nativeLowLodScale} from '../src/world/nativeLowLod';
test('native low-LOD scale combines exterior camera height with the regional fixed-point multiplier',()=>{
 expect(nativeLowLodScale(80,true)).toBe(1);expect(nativeLowLodScale(165,true)).toBeCloseTo(1.6,6);expect(nativeLowLodScale(250,true)).toBeCloseTo(2.2,6);expect(nativeLowLodScale(1000,true,.875)).toBeCloseTo(1.925,6);expect(nativeLowLodScale(350,false,.875)).toBe(.875);expect(nativeLowLodScale(-100,true)).toBe(1);
 expect(()=>nativeLowLodScale(NaN,true)).toThrow();expect(()=>nativeLowLodScale(1e300,true)).toThrow();expect(()=>nativeLowLodScale(0,true,-1)).toThrow();
});

test('scaled low-LOD fade keeps the width calculated before range scaling',async()=>{
 const {distanceFadeAlpha,distanceFadeWidth}=await import('../src/render/distanceFade');
 const width=distanceFadeWidth(400,400,false);
 expect(distanceFadeAlpha(190,200,400,false,width)).toBe(208);
});
