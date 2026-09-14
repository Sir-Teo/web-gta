import {expect,test} from 'vitest';
import {NATIVE_STARS,nativeStarLevel,nativeStarTwinkle} from '../src/world/nativeStars';
test('native star clock fades through 22 and 05 using integer game minutes',()=>{
  for(const [time,level] of [[0,255],[300,255],[330,127],[359,4],[360,0],[1319,0],[1320,0],[1350,127],[1380,255],[1440,255]])
    expect(nativeStarLevel(time)).toBe(level);
  expect(nativeStarLevel(1350.9)).toBe(127);expect(()=>nativeStarLevel(NaN)).toThrow();
});
test('source constellation retains two mirrored points and the separate large star',()=>{
  expect(NATIVE_STARS).toHaveLength(12);
  expect(NATIVE_STARS[0]).toEqual({x:100,y:10,z:0,size:.8});
  expect(NATIVE_STARS[9]).toEqual({...NATIVE_STARS[0],x:-100});
  expect(NATIVE_STARS[10]).toEqual({...NATIVE_STARS[1],x:-100});
  expect(NATIVE_STARS[11]).toEqual({x:100,y:10,z:90,size:5});
  expect(nativeStarTwinkle(0,0)).toBe(1);expect(nativeStarTwinkle(0,31)).toBeCloseTo(.535);
  expect(nativeStarTwinkle(11,0)).toBe(.5);expect(nativeStarTwinkle(11,127)).toBeCloseTo(.3015625);
});
