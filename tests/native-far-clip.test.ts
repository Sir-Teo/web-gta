import {test,expect} from 'vitest';
import {nativeAltitudeFarClip} from '../src/world/nativeFarClip';
test('native altitude correction leaves low terrain and short view distances unchanged',()=>{
 expect(nativeAltitudeFarClip(1500,200)).toBe(1500);
 expect(nativeAltitudeFarClip(800,900)).toBe(800);
 expect(nativeAltitudeFarClip(1000,350)).toBe(1000);
 expect(nativeAltitudeFarClip(1500,-20)).toBe(1500);
});
test('native far clip approaches 1000 between altitudes 200 and 500 and remains capped above',()=>{
 expect(nativeAltitudeFarClip(1600,275)).toBe(1450);
 expect(nativeAltitudeFarClip(1600,350)).toBe(1300);
 expect(nativeAltitudeFarClip(1600,500)).toBe(1000);
 expect(nativeAltitudeFarClip(1600,600)).toBe(1000);
 expect(()=>nativeAltitudeFarClip(Infinity,0)).toThrow('Invalid');
 expect(()=>nativeAltitudeFarClip(1000,NaN)).toThrow('Invalid');
});
