import {expect,test} from 'vitest';
import reference from './fixtures/native-grass-wind-reference.json';
import {nativeGrassWind} from '../src/world/nativeGrassWind';

test('native grass wind matches independent C++ float equations across thresholds and timer wrapping',()=>{
 expect(reference).toHaveLength(288);
 for(const [time,wind,seed,value] of reference){
  // libm sinf and JS sin can differ in their last float32 bit.
  expect(Math.abs(nativeGrassWind(time,wind,seed)-value),`${time}/${wind}/${seed}`).toBeLessThan(2e-9);
 }
});
test('calm grass sways without consuming a seed; stronger wind retains the source offset',()=>{
 expect(nativeGrassWind(1024,0,0)).toBeGreaterThan(.0049);
 expect(nativeGrassWind(1024,0,0)).toBe(nativeGrassWind(1024,0,65535));
 expect(nativeGrassWind(1024,0,0)).toBe(nativeGrassWind(5120,0,0));
 expect(nativeGrassWind(0,.5,0)).toBe(Math.fround(.015));
 expect(nativeGrassWind(0,1,0)).toBe(Math.fround(.03));
 expect(nativeGrassWind(0,1,65535)).not.toBe(nativeGrassWind(0,1,0));
});
test('wind rejects invalid native timer, weather and seed inputs',()=>{
 for(const args of [[-1,0,0],[2**32,0,0],[.5,0,0],[0,-1,0],[0,1.1,0],[0,NaN,0],[0,0,-1],[0,0,65536],[0,0,.5]])expect(()=>nativeGrassWind(...args as [number,number,number])).toThrow('wind state');
});
