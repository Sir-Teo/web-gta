import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {PerspectiveCamera,Scene} from 'three';
import {Simulation} from '../src/simulation/Simulation';
import {WADE,WorldFx,wadeStep,waterEntrySplash} from '../src/simulation/fx/WorldFx';
import {wadingSurface} from '../src/assets/surfaceAudio';

beforeAll(async()=>{await RAPIER.init();});

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

test('player and pedestrian walkers splash independently and prune on leave',()=>{
  const sim=new Simulation(),scene=new Scene(),camera=new PerspectiveCamera(55,1,.1,100);
  const fx=new WorldFx(scene,sim,camera);
  const splashes:{position:unknown;size:string}[]=[];
  try{
    (fx as unknown as {manager:{update():void;clear():void}}).manager={update(){},clear(){}};
    (fx as unknown as {effects:{waterSplash(position:unknown,size:string):void}}).effects={waterSplash:(position,size)=>{splashes.push({position,size});}};
    fx.waterLevel=()=>0;
    const player={position:{x:0,y:-.2,z:0},speed:3,grounded:true};
    const pedKey={},ped={key:pedKey,position:{x:5,y:-.2,z:0},speed:3,grounded:true};
    for(let i=0;i<13;i++)fx.step(1/60,[],[],[],[player,ped]);
    expect(splashes).toHaveLength(0);
    fx.step(1/60,[],[],[],[player,ped]);
    expect(splashes.filter(s=>s.size==='foot')).toHaveLength(2);
    // A walker that leaves stops accumulating and is pruned.
    fx.step(1/60,[],[],[],[player]);
    fx.step(1/60,[],[],[],[player]);
    expect((fx as unknown as {wadePeds:Map<object,unknown>}).wadePeds.size).toBe(0);
  }finally{fx.dispose();sim.dispose();}
});
