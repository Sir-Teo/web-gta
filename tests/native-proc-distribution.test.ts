import {expect,test} from 'vitest';
import {WindowsCrtRandom} from '../src/core/WindowsCrtRandom';
import {distributeNativeProcRandom} from '../src/world/nativeProcDistribution';
import type {NativeProcRule} from '../src/world/nativeProcRules';
const vertices=[[0,0,0],[0,4,0],[4,0,0]] as const,camera=[0,0,100] as const;
const rule=(density:number)=>({useGrid:0,inverseSpacingSquared:density/8,minimumDistanceSquared:6400} as NativeProcRule);
test('integer density keeps the source strict cutoff and fractional density draws only its last cutoff',()=>{
 for(const [density,cutoff,count,draws] of [[0,0,0,0],[1,0,0,0],[2,0,1,2],[3,0,2,4],[.5,.5,0,1],[.5,.49,1,3],[2.5,.49,3,7]]){
  let samples=0;const seeds:number[]=[];
  const random={next:()=>123,nextUnit:()=>{samples++;return cutoff;},reseed:(s:number)=>{seeds.push(s);}};
  expect(distributeNativeProcRandom(density===0?[[0,0,0],[0,4,0],[0,4,0]]:vertices,rule(density||1),865,camera,random,()=>true)).toEqual({attempted:count,added:count});
  expect(samples).toBe(draws);expect(seeds).toEqual([873,123]);
 }
});
test('allocation owns transform samples and failed allocations shift later positions',()=>{
 const run=(success:boolean)=>{const positions:unknown[]=[];const random=new WindowsCrtRandom(1792);
  const result=distributeNativeProcRandom(vertices,rule(4),865,camera,random,(p,_n,r)=>{positions.push(p);if(success)for(let i=0;i<4;i++)r.nextUnit();return success;});
  return {positions,result,next:random.next()};};
 const accepted=run(true),rejected=run(false);
 expect(accepted.result).toEqual({attempted:3,added:3});expect(rejected.result).toEqual({attempted:3,added:0});
 expect(accepted.positions[0]).toEqual(rejected.positions[0]);expect(accepted.positions[1]).not.toEqual(rejected.positions[1]);
 const restored=new WindowsCrtRandom(5890);expect(accepted.next).toBe(restored.next());expect(rejected.next).toBe(accepted.next);
});
test('near rejection leaves RNG untouched; zero density and callback failure still reseed from one prior output',()=>{
 const near=new WindowsCrtRandom(1792);distributeNativeProcRandom(vertices,rule(3),865,[0,0,0],near,()=>true);expect(near.next()).toBe(5890);
 for(const throws of [false,true]){
  const random=new WindowsCrtRandom(1792),run=()=>distributeNativeProcRandom(throws?vertices:[[0,0,0],[0,4,0],[0,4,0]],rule(2),865,camera,random,()=>{throw new Error('allocation');});
  if(throws)expect(run).toThrow('allocation');else expect(run()).toEqual({attempted:0,added:0});
  expect(random.next()).toBe(new WindowsCrtRandom(5890).next());
 }
});
test('invalid or unbounded inputs fail before allocation or random state mutation',()=>{
 const random=new WindowsCrtRandom(1792);
 expect(()=>distributeNativeProcRandom(vertices,{...rule(2),useGrid:1},865,camera,random,()=>true)).toThrow('grid');
 expect(()=>distributeNativeProcRandom(vertices,rule(100001),865,camera,random,()=>true)).toThrow('iteration limit');
 expect(()=>distributeNativeProcRandom(vertices,rule(2),-1,camera,random,()=>true)).toThrow('model ID');
 expect(random.next()).toBe(5890);
});
