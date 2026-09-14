import {expect,test} from 'vitest';
import reference from './fixtures/native-tree-wind-reference.json';
import {nativeTreeType,nativeTreeWind} from '../src/world/nativeTreeWind';

test('tree and palm wind match independent C++ float equations across phase and wind boundaries',()=>{
 expect(reference).toHaveLength(432);
 for(const row of reference){
  const [milliseconds,wind,seed,address,palm,x,y]=row as [number,number,number,number,boolean,number,number];
  const actual=nativeTreeWind({milliseconds,wind,seed,address,direction:[-.6,.8]},palm);
  expect(Math.abs(actual[0]-x),JSON.stringify(row)).toBeLessThan(5e-9);
  expect(Math.abs(actual[1]-y),JSON.stringify(row)).toBeLessThan(5e-9);
 }
});
test('IDE special-type precedence distinguishes damageable objects, trees and palms',()=>{
 expect(nativeTreeType(0x1000)).toBeUndefined();
 expect(nativeTreeType(8324)).toBe('tree');
 expect(nativeTreeType(12420)).toBe('tree');
 expect(nativeTreeType(0x6000|0x800|0x400)).toBe('palm');
 for(const flag of [0x80000,0x100000,0x400000])expect(nativeTreeType(flag|0x6000)).toBeUndefined();
 expect(nativeTreeType(0x200000|0x8000|0x2000)).toBe('tree');
 for(const flag of [-1,.5,NaN,2**32])expect(()=>nativeTreeType(flag)).toThrow('IDE flags');
});
test('calm phase uses the address, and direction magnitude is preserved',()=>{
 const state={milliseconds:0,wind:0,seed:0,address:1024,direction:[2,0] as const};
 expect(nativeTreeWind(state,false)[0]).toBeGreaterThan(.0099);
 expect(nativeTreeWind(state,false)[1]).toBe(0);
 expect(nativeTreeWind({...state,seed:65535},false)).toEqual(nativeTreeWind(state,false));
 expect(nativeTreeWind({...state,address:0},false)).toEqual([0,0]);
 expect(nativeTreeWind({...state,milliseconds:4096},false)).toEqual(nativeTreeWind(state,false));
});
test('invalid native inputs fail before any render mutation',()=>{
 const state={milliseconds:0,wind:0,seed:0,address:0,direction:[1,1] as const};
 for(const invalid of [{address:-1},{address:2**32},{address:.5},{milliseconds:-1},{wind:NaN},{seed:65536},{direction:[Infinity,0] as const},{direction:[1e100,0] as const}])expect(()=>nativeTreeWind({...state,...invalid},false)).toThrow();
});
