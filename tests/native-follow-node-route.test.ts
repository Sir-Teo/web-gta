import {describe,expect,test} from 'vitest';
import type {PathArea,PathNode} from '../src/assets/pathNodes';
import {NODE_ROUTE_SIZE,computePedNodeRoute,planFollowNodeRoute,type NodeRouteWorld} from '../src/simulation/nativeFollowNodeRoute';

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

describe('CTaskComplexFollowNodeRoute’s route',()=>{
 test('a near target with a clear way is walked straight at, the target the only point',()=>{
  const areas=area([[0,0,0],[10,0,0],[20,0,0]]);
  expect(planFollowNodeRoute(world(areas),{x:0,y:0,z:1},{x:20,y:0,z:1})).toEqual({points:[{x:20,y:0,z:1}],lastIsTarget:true});
 });

 test('a blocked way goes by the nodes, cut at the first from which the target is clear',()=>{
  const areas=area([[0,0,0],[0,10,0],[10,10,0],[20,10,0],[20,0,0]]);
  // Only from the node at (20,10) can the target at (20,0) be reached in a line.
  const clear=(from:{x:number;y:number})=>from.x===20&&from.y===10;
  const plan=planFollowNodeRoute(world(areas,clear),{x:0,y:0,z:1},{x:20,y:0,z:1});
  expect(plan.points).toEqual([{x:0,y:0,z:0},{x:0,y:10,z:0},{x:10,y:10,z:0},{x:20,y:10,z:0},{x:20,y:0,z:1}]);
  expect(plan.lastIsTarget).toBe(true);
 });

 test('a far target past the threshold distance takes the nodes even with nothing in the way',()=>{
  const areas=area([[0,0,0],[20,0,0],[40,0,0]]);
  const plan=planFollowNodeRoute(world(areas),{x:0,y:0,z:1},{x:40,y:0,z:1});
  // Cut at the first node within thirty units of the target: (20,0).
  expect(plan.points).toEqual([{x:0,y:0,z:0},{x:20,y:0,z:0},{x:40,y:0,z:1}]);
 });

 test('the shortest way wins, and eight nodes fill the route so the target waits for the next stretch',()=>{
  const line:[number,number,number][]=Array.from({length:12},(_,i)=>[i*5,0,0]);
  // A short cut from node 0 to node 11 through a node well off the line would be longer: the line is kept.
  line.push([27.5,40,0]);
  const areas=area(line,{extra:[[0,12],[12,11]]});
  const nodes=computePedNodeRoute(areas,{x:0,y:0,z:0},{x:55,y:0,z:0});
  expect(nodes.map(n=>n.address.node)).toEqual([0,1,2,3,4,5,6,7]);
  const plan=planFollowNodeRoute(world(areas,()=>false),{x:0,y:0,z:1},{x:55,y:0,z:1});
  expect(plan.points).toHaveLength(NODE_ROUTE_SIZE);expect(plan.lastIsTarget).toBe(false);
 });

 test('a route whose first node lies well past the target is dropped for the straight walk',()=>{
  const areas=area([[0,50,0],[50,50,0]]);
  // Nothing clear, but the only nodes are fifty units off: more than three past the target, which is five away.
  expect(planFollowNodeRoute(world(areas,()=>false),{x:0,y:0,z:1},{x:5,y:0,z:1}).points).toEqual([{x:5,y:0,z:1}]);
  // With the heights two apart the slack is fifty units, and the route (both ends nearest the same node) stands.
  expect(planFollowNodeRoute(world(areas,()=>false),{x:0,y:0,z:1},{x:5,y:0,z:4}).points).toEqual([{x:0,y:50,z:0},{x:5,y:0,z:4}]);
 });

 test('nodes in different flood-fill groups give no route',()=>{
  const areas=area([[0,0,0],[10,0,0]],{floodFill:i=>i+1});
  expect(computePedNodeRoute(areas,{x:0,y:0,z:0},{x:10,y:0,z:0})).toEqual([]);
 });
});
