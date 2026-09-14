import {expect,test} from 'vitest';
import {WindowsCrtRandom} from '../src/core/WindowsCrtRandom';
import {windowsCrtGrassSamples} from '../src/world/windowsCrtGrassSamples';

test('Windows CRT matches the ten outputs in Microsoft rand documentation for seed 1792',()=>{
 const random=new WindowsCrtRandom(1792);
 expect(Array.from({length:10},()=>random.next())).toEqual([5890,1279,19497,1207,11420,3377,15317,29489,9716,23323]);
});
test('jump-ahead agrees with an independent BigInt recurrence including large uint32 seeds',()=>{
 for(const seed of [0,1,1792,0xffffffff])for(const count of [0,1,2,31,256,65535]){
  const random=new WindowsCrtRandom(seed);random.advance(count);
  let state=BigInt(seed);for(let i=0;i<=count;i++)state=(state*214013n+2531011n)&0xffffffffn;
  expect(random.next()).toBe(Number((state>>16n)&32767n));
 }
 const a=new WindowsCrtRandom(17),b=new WindowsCrtRandom(17);a.advance(0xffffffff);a.advance(1);expect(a.next()).toBe(b.next());
});
test('grass indexed samples match sequential CRT consumption and preserve numeric seed casting',()=>{
 const sequential=new WindowsCrtRandom(0);
 for(let index=0;index<100;index++)expect(windowsCrtGrassSamples(.75,index)).toEqual(Array.from({length:5},()=>sequential.nextUnit()));
 expect(windowsCrtGrassSamples(0,0)).toEqual(windowsCrtGrassSamples(.999,0));
 expect(windowsCrtGrassSamples(1,0)).not.toEqual(windowsCrtGrassSamples(0,0));
 expect(windowsCrtGrassSamples(1-1e-9,0)).toEqual(windowsCrtGrassSamples(1,0));
 for(const seed of [-1,NaN,0x100000000,.5])expect(()=>new WindowsCrtRandom(seed)).toThrow();
 expect(()=>sequential.advance(-1)).toThrow();expect(()=>windowsCrtGrassSamples(.5,65536)).toThrow();
});
test('native float sampling includes both zero and one',()=>{
 const zero=new WindowsCrtRandom(1),one=new WindowsCrtRandom(1);zero.advance(25199);one.advance(38723);
 expect(zero.nextUnit()).toBe(0);expect(one.nextUnit()).toBe(1);
});
