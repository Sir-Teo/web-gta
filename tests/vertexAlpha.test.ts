import { expect,test } from 'vitest';
import { materialVertexAlpha } from '../src/assets/vertexAlpha';

test('native alpha spans include unindexed vertices between the minimum and maximum index',()=>{
  const day=new Uint8Array(24).fill(255),night=day.slice();night[2*4+3]=128;
  expect(materialVertexAlpha([day,night],[{min:0,max:3},{min:3,max:5},{min:Infinity,max:-1},{min:2,max:2}])).toEqual([true,false,false,true]);
  expect(materialVertexAlpha([day],[{min:0,max:3},{min:3,max:5}])).toEqual([false,false]);
});

test('missing palettes and vertices use opaque alpha',()=>{
  const colors=new Uint8Array([100,0,0,255,255,255,255,0]);
  expect(materialVertexAlpha([undefined],[{min:0,max:2},{min:Infinity,max:-1}])).toEqual([false,false]);
  expect(materialVertexAlpha([colors],[{min:2,max:4},{min:0,max:4}])).toEqual([false,true]);
});
