import {describe,expect,test} from 'vitest';
import {findClosestStraightRoad,findNodeCoorsForScript,findNodeOrientationForCarPlacement,findNodePairClosestToCoors,findNthNodeClosestToCoors,nodeScore} from '../src/simulation/nativeScriptCarNodes';
import type {PathArea,PathNode} from '../src/assets/pathNodes';

// One area: three car nodes along a road running north (+y), one switched off, one boat node and one ped node.
function area():Map<number,PathArea>{
 const node=(i:number,position:[number,number,number],extra:Partial<PathNode>={}):PathNode=>({address:{area:0,node:i},position,kind:'vehicle',baseLink:0,linkCount:0,width:0,floodFill:0,flags:0,deadEnd:false,switchedOff:false,switchedOffOriginal:false,water:false,dontWander:false,spawnProbability:15,behaviour:0,...extra});
 const nodes=[
  node(0,[0,0,0],{baseLink:0,linkCount:1,width:1}),
  node(1,[0,10,0],{baseLink:1,linkCount:2}),
  node(2,[0,20,0],{baseLink:3,linkCount:1,switchedOff:true}),
  node(3,[1,1,0],{water:true}),
  node(4,[0,1,0],{kind:'pedestrian'}),
 ];
 const links=[{area:0,node:1},{area:0,node:0},{area:0,node:2},{area:0,node:1}];
 return new Map([[0,{area:0,vehicleCount:4,pedestrianCount:1,linkCount:4,nodes,navigation:[],links,navigationLinks:[],lengths:new Uint8Array(),intersections:new Uint8Array(),bytesRead:0}]]);
}
const car={kind:'vehicle' as const,maxDistance:999999.9};

describe('the car path questions the script asks',()=>{
 test('the nth node passes over the ones nearer, and over switched-off and boat nodes when asked',()=>{
  const areas=area(),at={x:0,y:19,z:0};
  expect(findNthNodeClosestToCoors(areas,at,0,car)?.address.node).toBe(2);
  expect(findNthNodeClosestToCoors(areas,at,1,car)?.address.node).toBe(1);
  expect(findNthNodeClosestToCoors(areas,at,0,{...car,ignoreDisabled:true})?.address.node).toBe(1);
  // Three land car nodes, so there is no fourth.
  expect(findNthNodeClosestToCoors(areas,at,3,car)).toBeUndefined();
  expect(findNthNodeClosestToCoors(areas,{x:1,y:1,z:0},0,{...car,water:true})?.address.node).toBe(3);
  // The score is 0.3 × (|dx| + |dy| + 3|dz|) + 0.2 × the distance to the nearest link: from 4.5 north and 2 up, node 0
  // scores 0.3 × 10.5 + 0.2 × 2 and node 1 0.3 × 11.5 + 0.2 × 2.
  expect(findNthNodeClosestToCoors(areas,{x:0,y:4.5,z:2},0,car)?.address.node).toBe(0);
  expect(findNthNodeClosestToCoors(areas,{x:0,y:5.5,z:2},0,car)?.address.node).toBe(1);
  // Node 2, one unit off with its link through the point, scores 0.3: under 0.5, not under 0.25.
  expect(findNthNodeClosestToCoors(areas,at,0,{...car,maxDistance:.5})?.address.node).toBe(2);
  expect(findNthNodeClosestToCoors(areas,at,0,{...car,maxDistance:.25})).toBeUndefined();
  expect(nodeScore(areas,areas.get(0)!.nodes[2],at,Infinity)).toBeCloseTo(.3,6);
  // A node with no links: 0.2 × √999999.875 more.
  expect(nodeScore(areas,areas.get(0)!.nodes[3],{x:1,y:1,z:0},Infinity)).toBeCloseTo(.2*Math.sqrt(999999.875),3);
 });

 test('a node with width gives the point beside it; one without gives itself',()=>{
  const areas=area(),nodes=areas.get(0)!.nodes;
  // The way to the first link is north, turned east-facing (x ≥ 0) it stays north; its left is west, 1 + 2.7 away.
  const beside=findNodeCoorsForScript(areas,nodes[0]);
  expect(beside.x).toBeCloseTo(-3.7,6);expect(beside.y).toBeCloseTo(0,6);
  expect(findNodeCoorsForScript(areas,nodes[1])).toEqual({x:0,y:10,z:0});
 });

 test('a car set down on a node faces its first link',()=>{
  const areas=area(),nodes=areas.get(0)!.nodes;
  expect(findNodeOrientationForCarPlacement(areas,nodes[0])).toBeCloseTo(0,6);
  // Node 1's first link is node 0, to the south.
  expect(Math.abs(findNodeOrientationForCarPlacement(areas,nodes[1]))).toBeCloseTo(180,6);
  expect(findNodeOrientationForCarPlacement(areas,nodes[3])).toBe(0);
 });

 test('FindNodePairClosestToCoors: the nearest node with a link longer than the minimum, found within the reach',()=>{
  const areas=area();
  // From (0, 9, 0): node 1 is 1 off, and of its links (to 0, and to the switched-off 2) only 0's counts.
  const pair=findNodePairClosestToCoors(areas,{x:0,y:9,z:0},5,100)!;
  expect([pair.first.address.node,pair.second.address.node]).toEqual([1,0]);
  // The heading is the way from the second node to the first: north.
  expect(pair.heading).toBeCloseTo(0,4);
  // A link no longer than the minimum does not count; the reach is the measure, not the link's length.
  expect(findNodePairClosestToCoors(areas,{x:0,y:9,z:0},10,100)).toBeUndefined();
  expect(findNodePairClosestToCoors(areas,{x:0,y:9,z:0},5,1)).toBeUndefined();
  expect(findNodePairClosestToCoors(areas,{x:0,y:9,z:0},5,1.5)).toBeDefined();
  // From the south end, node 0's one link runs to 1: the heading points south, unwrapped.
  expect(Math.abs(findNodePairClosestToCoors(areas,{x:0,y:-1,z:0},5,100)!.heading)).toBeCloseTo(180,3);
  // The script's points are FindNodeCoorsForScript's: node 0 has width, so its point stands beside it.
  const road=findClosestStraightRoad(areas,{x:0,y:-1,z:0},5,100)!;
  expect(road.node1X).toBeCloseTo(findNodeCoorsForScript(areas,areas.get(0)!.nodes[0]).x,6);
 });
});
