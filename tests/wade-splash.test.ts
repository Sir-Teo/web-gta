import {expect,test} from 'vitest';
import {WADE,wadeStep,waterEntrySplash} from '../src/simulation/fx/WorldFx';
import {wadingSurface} from '../src/assets/surfaceAudio';

test('wading splashes every stride in shallow water, and reset otherwise',()=>{
  const state={distance:0};
  // Dry or deep water, standing still or airborne: no splash, accumulator cleared.
  expect(wadeStep(state,1/60,3,true,undefined)).toBe(false);
  expect(wadeStep(state,1/60,3,true,-.1)).toBe(false);
  expect(wadeStep(state,1/60,3,true,.8)).toBe(false);
  expect(wadeStep(state,1/60,.2,true,.2)).toBe(false);
  expect(wadeStep(state,1/60,3,false,.2)).toBe(false);
  expect(state.distance).toBe(0);
  // Walking at 3 m/s: 0.05 m per frame; the 0.7 m stride splashes on the 14th frame.
  let splashes=0;
  for(let i=0;i<13;i++)if(wadeStep(state,1/60,3,true,.2))splashes++;
  expect(splashes).toBe(0);
  expect(wadeStep(state,1/60,3,true,.2)).toBe(true);
  expect(state.distance).toBe(0);
  // Bounds: 2 cm and 60 cm still wade.
  expect(wadeStep({distance:WADE.stride},1/60,3,true,WADE.minDepth)).toBe(true);
  expect(wadeStep({distance:WADE.stride},1/60,3,true,WADE.maxDepth)).toBe(true);
});

test('airborne water entry splashes once per crossing',()=>{
  expect(waterEntrySplash(false,false,.5)).toBe(true);
  expect(waterEntrySplash(true,false,.5)).toBe(false);
  expect(waterEntrySplash(false,true,.5)).toBe(false);
  expect(waterEntrySplash(false,false,.05)).toBe(false);
  expect(waterEntrySplash(false,false,undefined)).toBe(false);
});

test('feet under open water step onto the swimming bank',()=>{
  const sand={concrete:false,grass:false,sand:true,gravel:false,wood:false,water:false,metal:false,longGrass:false,tile:false};
  expect(wadingSurface(sand,-.1)).toBe(sand);
  expect(wadingSurface(sand,undefined)).toBe(sand);
  expect(wadingSurface(undefined,.2)).toMatchObject({water:true,concrete:false,sand:false});
  const wet=wadingSurface(sand,.2)!;
  expect(wet.water).toBe(true);expect(wet.sand).toBe(false);
});
