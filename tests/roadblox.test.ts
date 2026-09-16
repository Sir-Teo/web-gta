import {expect,test} from 'vitest';
import {MAX_ROADBLOCKS,readRoadblox} from '../src/assets/roadblox';
import {chooseRoadblock,roadblockPairSpot,ROADBLOCK_PAIR_OFFSET} from '../src/simulation/WorldPolice';
import type {TrafficLink} from '../src/simulation/trafficRoute';

function synthetic(count:number){
  const bytes=new Uint8Array(4+MAX_ROADBLOCKS*4),view=new DataView(bytes.buffer);
  view.setInt32(0,count,true);
  for(let i=0;i<Math.max(0,count);i++){view.setInt16(4+i*4,i%8,true);view.setUint16(4+i*4+2,100+i,true);}
  return bytes;
}

test('roadblox.dat reads the documented count + node table',()=>{
  const nodes=readRoadblox(synthetic(3));
  expect(nodes).toEqual([{areaId:0,nodeId:100},{areaId:1,nodeId:101},{areaId:2,nodeId:102}]);
  expect(readRoadblox(synthetic(-1))).toEqual([]);
  expect(()=>readRoadblox(new Uint8Array(10))).toThrow();
  expect(()=>readRoadblox(synthetic(326))).toThrow();
});

const link=(start:{x:number;z:number},dx:number,dz:number,length:number)=>({start,dx,dz,length,from:{position:[start.x,0,start.z]}} as unknown as TrafficLink);

test('roadblock choice takes the longest link ahead of the driven car, across the road',()=>{
  const player={x:0,z:0},velocity={x:0,z:-20};
  const ahead=link({x:0,z:-40},0,-1,40),short=link({x:0,z:-60},0,-1,20),side=link({x:50,z:-40},0,-1,60),behind=link({x:0,z:80},0,-1,60);
  const choice=chooseRoadblock([short,side,behind,ahead],player,velocity);
  expect(choice?.link).toBe(ahead);
  // Across-road heading is 90° from the link direction.
  const along=Math.atan2(-0,-(-1));
  let delta=Math.abs(choice!.heading-along)%(Math.PI*2);
  if(delta>Math.PI)delta=Math.PI*2-delta;
  expect(delta).toBeCloseTo(Math.PI/2,10);
  expect(chooseRoadblock([ahead],player,{x:0,z:-2})).toBeUndefined();
  expect(chooseRoadblock([behind],player,velocity)).toBeUndefined();
});

test('the paired roadblock car stands one lane over from the lead car',()=>{
  expect(ROADBLOCK_PAIR_OFFSET).toBe(7);
  // Eastbound link: the pair sits 7 units to the side, spanning the road.
  expect(roadblockPairSpot(0,0,{dx:1,dz:0})).toEqual({x:0,z:7});
  expect(roadblockPairSpot(10,-40,{dx:0,dz:-1},14)).toEqual({x:24,z:-40});
});
