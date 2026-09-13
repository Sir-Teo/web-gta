import {expect,test} from 'vitest';
import {stepNativeShadowIntensity,nativeShadowStrength} from '../src/render/nativeShadowIntensity';
test('shadow intensity changes by three per manager update and saturates without unsigned underflow',()=>{
 let intensity=0;for(let i=0;i<33;i++)intensity=stepNativeShadowIntensity(intensity,true);expect(intensity).toBe(99);
 intensity=stepNativeShadowIntensity(intensity,true);expect(intensity).toBe(100);expect(stepNativeShadowIntensity(intensity,true)).toBe(100);
 for(let i=0;i<33;i++)intensity=stepNativeShadowIntensity(intensity,false);expect(intensity).toBe(1);expect(stepNativeShadowIntensity(intensity,false)).toBe(0);expect(stepNativeShadowIntensity(0,false)).toBe(0);
 expect(stepNativeShadowIntensity(49,true)).toBe(52);expect(stepNativeShadowIntensity(52,false)).toBe(49);
});
test('camera-distance attenuation precedes integer strength and intensity percentage truncation',()=>{
 expect(nativeShadowStrength(255,0,100)).toBe(255);expect(nativeShadowStrength(255,7.5,100)).toBe(255);
 expect(nativeShadowStrength(255,11.25,100)).toBe(127);expect(nativeShadowStrength(255,11.25,50)).toBe(63);
 expect(nativeShadowStrength(244,10,61)).toBe(98); // Combining both fades before truncating would give 99.
 expect(nativeShadowStrength(255,15,100)).toBe(0);expect(nativeShadowStrength(255,16,100)).toBe(0);
 expect(nativeShadowStrength(255,0,0)).toBe(0);expect(nativeShadowStrength(0,0,100)).toBe(0);
});
test('invalid fade controls do not silently wrap',()=>{
 for(const n of [-1,101,.5,NaN])expect(()=>stepNativeShadowIntensity(n,true)).toThrow('intensity');
 for(const [strength,distance,intensity] of [[256,0,100],[255,-1,100],[255,NaN,100],[255,0,101]])expect(()=>nativeShadowStrength(strength,distance,intensity)).toThrow('strength');
});
