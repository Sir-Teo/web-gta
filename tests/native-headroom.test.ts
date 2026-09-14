import {expect,test} from 'vitest';
import {nativeHeadroomGain} from '../src/audio/nativeHeadroom';
test('native signed hundredth-dB headroom subtracts from amplitude without normalizing PCM',()=>{
 expect(nativeHeadroomGain(0)).toBe(1);expect(nativeHeadroomGain(2000)).toBeCloseTo(.1,12);
 expect(nativeHeadroomGain(-2000)).toBe(10);expect(nativeHeadroomGain(600)).toBeCloseTo(.5011872336,9);
 expect(nativeHeadroomGain(1834)).toBeCloseTo(.121,3);
 for(const raw of [-32768,32767])expect(Number.isFinite(nativeHeadroomGain(raw))).toBe(true);
 for(const raw of [NaN,Infinity,.5,-32769,32768])expect(()=>nativeHeadroomGain(raw)).toThrow();
});
