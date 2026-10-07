import {describe,expect,test} from 'vitest';
import type {PathArea,PathNode} from '../src/assets/pathNodes';
import {NODE_ROUTE_SIZE,computePedNodeRoute,followRouteSeconds,planFollowNodeRoute,type NodeRouteWorld} from '../src/simulation/nativeFollowNodeRoute';

/** One area of ped nodes at the given points, each linked both ways to the next (a line), plus any extra links. */
function area(points:[number,number,number][],{floodFill=()=>1,extra=[] as [number,number][]}:{floodFill?:(i:number)=>number;extra?:[number,number][]}={}):Map<number,PathArea>{
 const neighbours=points.map((_,i)=>[i-1,i+1].filter(j=>j>=0&&j<points.length));
 for(const [a,b] of extra){neighbours[a].push(b);neighbours[b].push(a);}
 const links:PathArea['links']=[],lengths:number[]=[];
 const nodes:PathNode[]=points.map((position,i)=>{
  const baseLink=links.length;
  for(const j of neighbours[i]){links.push({area:0,node:j});lengths.push(Math.round(Math.hypot(points[j][0]-position[0],points[j][1]-position[1],points[j][2]-position[2])));}
  return {address:{area:0,node:i},position,kind:'pedestrian',baseLink,linkCount:neighbours[i].length,width:0,floodFill:floodFill(i),flags:0,
   deadEnd:false,switchedOff:false,switchedOffOriginal:false,water:false,dontWander:false,spawnProbability:0,behaviour:0};
 });
 return new Map([[0,{area:0,vehicleCount:0,pedestrianCount:nodes.length,linkCount:links.length,nodes,navigation:[],links,navigationLinks:links.map(()=>null),
  lengths:Uint8Array.from(lengths),intersections:new Uint8Array(links.length),bytesRead:0}]]);
}
const world=(areas:Map<number,PathArea>,clear:NodeRouteWorld['clear']=()=>true):NodeRouteWorld=>({areas,clear});

describe('CTaskComplexFollowNodeRoute’s route (iOS ComputePathNodes and DoPathSearch)',()=>{
 test('a near target with a clear way is walked straight at, the target the only point',()=>{
  const areas=area([[0,0,0],[10,0,0],[20,0,0]]);
  expect(planFollowNodeRoute(world(areas),{x:0,y:0,z:1},{x:20,y:0,z:1})).toMatchObject({points:[{x:20,y:0,z:1}],lastIsTarget:true,nodes:[],resumeAt:0});
 });

 test('a blocked way goes by the nodes, cut at the first from which the target is clear',()=>{
  // A spur behind the ped's node (the first point) keeps that node from being the farthest from the target.
  const areas=area([[-10,0,0],[0,0,0],[0,10,0],[10,10,0],[20,10,0],[20,0,0]]);
  const clear=(from:{x:number;y:number})=>from.x===20&&from.y===10;
  const plan=planFollowNodeRoute(world(areas,clear),{x:0,y:0,z:1},{x:20,y:0,z:1},{keepNodesHeadingAway:true});
  expect(plan.points).toEqual([{x:0,y:0,z:0},{x:0,y:10,z:0},{x:10,y:10,z:0},{x:20,y:10,z:0},{x:20,y:0,z:1}]);
  expect(plan.lastIsTarget).toBe(true);
 });

 test('a far target past the threshold distance takes the nodes even with nothing in the way',()=>{
  const areas=area([[0,0,0],[20,0,0],[40,0,0],[-20,0,0]],{extra:[[0,3]]});
  const plan=planFollowNodeRoute(world(areas),{x:0,y:0,z:1},{x:40,y:0,z:1},{keepNodesHeadingAway:true});
  // Cut at the first node within thirty units of the target: (20,0).
  expect(plan.points).toEqual([{x:0,y:0,z:0},{x:20,y:0,z:0},{x:40,y:0,z:1}]);
 });

 test('the shortest way wins, read back by the first link that drops by its length; eight nodes fill the route',()=>{
  const line:[number,number,number][]=Array.from({length:12},(_,i)=>[i*5,0,0]);
  // A short cut from node 0 to node 11 through a node well off the line would be longer: the line is kept.
  line.push([27.5,40,0],[-5,0,0]);
  const areas=area(line,{extra:[[0,12],[12,11],[0,13]]});
  const nodes=computePedNodeRoute(areas,{x:0,y:0,z:0},{x:55,y:0,z:0});
  expect(nodes.map(n=>n.address.node)).toEqual([0,1,2,3,4,5,6,7]);
  const plan=planFollowNodeRoute(world(areas,()=>false),{x:0,y:0,z:1},{x:55,y:0,z:1},{keepNodesHeadingAway:true});
  expect(plan.points).toHaveLength(NODE_ROUTE_SIZE);expect(plan.lastIsTarget).toBe(false);
 });

 test('both ends on one node, or the ped\'s node the farthest from the target, give no route',()=>{
  const areas=area([[0,0,0],[10,0,0],[20,0,0]]);
  expect(computePedNodeRoute(areas,{x:1,y:0,z:0},{x:2,y:0,z:0})).toEqual([]);
  // The ped's node (0) ends the line: the search runs dry as it gets there (DoPathSearch's order).
  expect(computePedNodeRoute(areas,{x:0,y:0,z:0},{x:20,y:0,z:0})).toEqual([]);
  // From the middle it is found.
  expect(computePedNodeRoute(areas,{x:10,y:0,z:0},{x:20,y:0,z:0}).map(n=>n.address.node)).toEqual([1,2]);
 });

 test('a seek drops a route whose first node lies farther from the target than the ped by 3 (50 across a height step)',()=>{
  // The ped stands 24 short of the target; the node nearest him is 20 behind him, 44 from the target; a spur keeps it
  // from being the farthest.
  const areas=area([[-30,0,0],[-20,0,0],[30,0,0]]);
  const ped={x:0,y:0,z:1},target={x:24,y:0,z:1};
  const blocked=world(areas,()=>false);
  expect(planFollowNodeRoute(blocked,ped,target).nodes).toEqual([]);
  // The script's form keeps it.
  expect(planFollowNodeRoute(blocked,ped,target,{keepNodesHeadingAway:true}).nodes.length).toBeGreaterThan(0);
  // Across a height step the slack is 50.
  expect(planFollowNodeRoute(blocked,ped,{x:24,y:0,z:4}).nodes.length).toBeGreaterThan(0);
 });

 test('a new route resumes at the node the ped was walking to',()=>{
  const line:[number,number,number][]=Array.from({length:6},(_,i)=>[i*40,0,0]);line.push([-40,0,0]);
  const areas=area(line,{extra:[[0,6]]});
  const first=planFollowNodeRoute(world(areas,()=>false),{x:0,y:0,z:1},{x:200,y:0,z:1},{keepNodesHeadingAway:true});
  const heading=first.nodes[2];
  const again=planFollowNodeRoute(world(areas,()=>false),{x:0,y:0,z:1},{x:200,y:0,z:1},{keepNodesHeadingAway:true,currentNode:heading});
  expect(again.resumeAt).toBe(2);
  expect(planFollowNodeRoute(world(areas,()=>false),{x:0,y:0,z:1},{x:200,y:0,z:1},{keepNodesHeadingAway:true,currentNode:line.length as never}).resumeAt).toBe(0);
 });

 test('nodes in different flood-fill groups give no route',()=>{
  const areas=area([[0,0,0],[10,0,0]],{floodFill:i=>i+1});
  expect(computePedNodeRoute(areas,{x:0,y:0,z:0},{x:10,y:0,z:0})).toEqual([]);
 });

 test('the script\'s time: -1 is 50 s, -2 or any other negative no limit',()=>{
  expect(followRouteSeconds(-1)).toBe(50);expect(followRouteSeconds(-2)).toBe(Number.POSITIVE_INFINITY);
  expect(followRouteSeconds(-7)).toBe(Number.POSITIVE_INFINITY);expect(followRouteSeconds(10000)).toBe(10);
 });
});

import {cornerMoveRatio,cornerSlowing,goToPointFineBaseRatio} from '../src/simulation/nativeFollowNodeRoute';
test('CalcGoToTaskType slows a jog, run or sprint into a corner sharper than 45°, toward 1.75 at the point',()=>{
 expect([4,5,6,7,1].map(goToPointFineBaseRatio)).toEqual([1,0,2,3,0]);
 const square={prev:{x:0,y:0},at:{x:10,y:0},right:{x:10,y:10},ahead:{x:20,y:1}};
 // A walk never slows; a gentle bend does not either.
 expect(cornerSlowing(4,square.prev,square.at,square.right)).toBeUndefined();
 expect(cornerSlowing(6,square.prev,square.at,square.ahead)).toBeUndefined();
 // A right angle: dot 0, so (0 + 1) / -1.707 + 1 = 0.414 of 1.5 running (3 sprinting), within 4 (5).
 const run=cornerSlowing(6,square.prev,square.at,square.right)!,sprint=cornerSlowing(7,square.prev,square.at,square.right)!;
 expect(run.amount).toBeCloseTo((1-1/Math.fround(1.707))*1.5,5);expect(run.distance).toBe(4);
 expect(sprint.amount).toBeCloseTo((1-1/Math.fround(1.707))*3,5);expect(sprint.distance).toBe(5);
 // A hairpin (the last node, whose "next" is the one before): the whole amount.
 expect(cornerSlowing(6,square.prev,square.at,square.prev)!.amount).toBeCloseTo(1.5,6);
 // Outside the distance: the ped's own pace; at the point: base − amount, floored at 1.75.
 expect(cornerMoveRatio(run,16,6)).toBeUndefined();
 expect(cornerMoveRatio(run,0,6)).toBeCloseTo(Math.max(1.75,2-run.amount),6);
 expect(cornerMoveRatio(sprint,0,7)).toBeCloseTo(3-sprint.amount,6);
 expect(cornerMoveRatio({amount:3,distance:5},0,7)).toBe(1.75);
 // Halfway in (d²/D² = 0.5): half the slowing.
 expect(cornerMoveRatio(sprint,12.5,7)).toBeCloseTo(3-.5*sprint.amount,6);
 // A jog's base ratio is 0, so in a corner it moves at 1.75.
 expect(cornerMoveRatio(cornerSlowing(5,square.prev,square.at,square.right)!,0,5)).toBe(1.75);
});
