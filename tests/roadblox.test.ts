import {expect,test} from 'vitest';
import {MAX_ROADBLOCKS,readRoadblox} from '../src/assets/roadblox';
import {readFileSync} from 'node:fs';
import {NativeRoadBlocks,roadBlockNodeInfo,type RoadBlockPaths} from '../src/police/nativeRoadBlocks';
import type {NavigationNode,PathNode} from '../src/assets/pathNodes';

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

test('the published roadblox.dat lists its nodes',()=>{
  const nodes=readRoadblox(new Uint8Array(readFileSync('public/play/world/files/data/paths/roadblox.dat')));
  expect(nodes.length).toBeGreaterThan(100);expect(nodes.length).toBeLessThanOrEqual(MAX_ROADBLOCKS);
  expect(nodes.every(n=>n.areaId>=0&&n.areaId<64)).toBe(true);
});

// One area: node 0 at (0,0) with navigation links 0 and 1 on a road running north (two lanes each way).
const pathNode=(position:[number,number,number],width=0):PathNode=>({address:{area:0,node:0},position,kind:'vehicle',baseLink:0,linkCount:2,width,floodFill:0,flags:0,deadEnd:false,switchedOff:false,switchedOffOriginal:false,water:false,dontWander:false,spawnProbability:15,behaviour:0});
const navi=(y:number):NavigationNode=>({position:[0,y],attachedTo:{area:0,node:0},direction:[0,1],width:0,oppositeLanes:2,sameLanes:2,trafficLightDirection:false,trafficLightState:0,bridgeLights:false,flags:0});
const paths=(node:PathNode):RoadBlockPaths=>({node:a=>a.area===0&&a.node===0?node:undefined,naviLink:(_area,link)=>link===0?navi(-5):link===1?navi(5):undefined});

test('GetRoadBlockNodeInfo: width from the widest link, (lanes + 1) x 5, across the road to its right',()=>{
  const info=roadBlockNodeInfo(pathNode([0,0,0]),paths(pathNode([0,0,0])))!;
  expect([info.width,info.dir.x,info.dir.y+0]).toEqual([25,1,0]);
});

test('a node rolls once as the driving, wanted player comes within 90 units, against the chance out of 128',()=>{
  const node=pathNode([0,0,10],2),blocks=new NativeRoadBlocks([{areaId:0,nodeId:0}]),made:[any,any][]=[];
  let roll=50;const go=(frame:number,player:{x:number;y:number},chance=12,inVehicle=true)=>blocks.generate(frame,chance,inVehicle,{...player,z:10},paths(node),()=>roll,()=>true,(a,b)=>made.push([a,b]));
  // Out of range: the node is marked out. Nothing rolls while the player stays outside.
  go(0,{x:200,y:0});expect(blocks.inOrOut[0]).toBe(false);
  // In range: one roll; 50 is not under 12, so no roadblock, and no second roll while he stays.
  go(0,{x:10,y:0});expect(made).toEqual([]);expect(blocks.inOrOut[0]).toBe(true);
  roll=0;go(0,{x:10,y:0});expect(made).toEqual([]);
  // Out and back in, with a roll under the chance: a node with its own path width gets a block each side.
  go(0,{x:200,y:0});go(0,{x:10,y:0});
  expect(made.map(pair=>pair.map((v:any)=>[v.x,v.y+0,v.z]))).toEqual([[[14.5,0,10],[2,0,10]],[[-2,0,10],[-14.5,0,10]]]);
  // No chance (under three stars, or backed off) or on foot: nothing, and the table resets for the next pursuit.
  made.length=0;go(0,{x:200,y:0},0);go(0,{x:10,y:0},0);go(0,{x:200,y:0},12,false);expect(made).toEqual([]);expect(blocks.generateDynamic).toBe(false);
});

test('a script roadblock goes up as the player comes back within 90 units of it',()=>{
  const blocks=new NativeRoadBlocks([]),made:any[]=[];
  blocks.registerScript({x:0,y:0,z:0},{x:10,y:0,z:0},false);
  const go=(x:number)=>{for(let f=0;f<16;f++)blocks.generate(f,0,false,{x,y:0,z:0},{node:()=>undefined,naviLink:()=>undefined},()=>0,()=>true,(a,b)=>made.push([a,b]));};
  go(20);expect(made.length).toBe(1);go(20);expect(made.length).toBe(1);
  go(200);go(20);expect(made.length).toBe(2);
  blocks.clearScript();go(200);go(20);expect(made.length).toBe(2);
});
