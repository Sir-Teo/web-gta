import {expect,test} from 'vitest';
import {nativeSoundFrequency} from '../src/audio/nativeFrequency';
test('native sound frequency uses additive symmetric variance around the supplied speed',()=>{
 expect(nativeSoundFrequency(1,.0588,0)).toBeCloseTo(.9412,6);
 expect(nativeSoundFrequency(1,.0588,.5)).toBe(1);
 expect(nativeSoundFrequency(1,.0588,1)).toBeCloseTo(1.0588,6);
 expect(nativeSoundFrequency(2,.0588,0)).toBeCloseTo(1.9412,6);
 expect(nativeSoundFrequency(1,.0588,.25)).toBeCloseTo(.9706,6);
});
test('native sound frequency disables nonpositive or excessive variance and rejects invalid inputs',()=>{
 for(const variance of [-1,0,1,2])expect(nativeSoundFrequency(1,variance,0)).toBe(1);
 for(const [speed,variance,random] of [[0,.1,.5],[NaN,.1,.5],[1,Infinity,.5],[1,.1,-.1],[1,.1,1.1],[1e300,.1,.5]])expect(()=>nativeSoundFrequency(speed,variance,random)).toThrow();
});
