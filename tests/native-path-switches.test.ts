import {describe,expect,test} from 'vitest';
import {applyStoredSwitches,markRoadNodeAsDontWander,switchRoadsOffInArea,unmarkAllRoadNodesAsDontWander} from '../src/simulation/nativePathSwitches';
import type {PathArea,PathNode} from '../src/assets/pathNodes';

/* A road running north, 0 - 1 - 2 - 3, into a junction at 3 with three spurs 4, 5 and 6, and one ped node 7. */
function road(extra:Record<number,Partial<PathNode>>={}):Map<number,PathArea>{
 const graph:number[][]=[[1],[0,2],[1,3],[2,4,5,6],[3],[3],[3],[]];
 const positions:[number,number,number][]=[[0,0,0],[0,10,0],[0,20,0],[0,30,0],[-10,30,0],[10,30,0],[0,40,0],[5,5,0]];
 const links:{area:number;node:number}[]=[];
 const nodes=graph.map((linked,i):PathNode=>{
  const baseLink=links.length;links.push(...linked.map(node=>({area:0,node})));
  return {address:{area:0,node:i},position:positions[i],kind:i<7?'vehicle':'pedestrian',baseLink,linkCount:linked.length,width:0,floodFill:0,flags:0,
   deadEnd:false,switchedOff:false,switchedOffOriginal:false,water:false,dontWander:false,spawnProbability:15,behaviour:0,...extra[i]};
 });
 return new Map([[0,{area:0,vehicleCount:7,pedestrianCount:1,linkCount:links.length,nodes,navigation:[],links,navigationLinks:[],lengths:new Uint8Array(),intersections:new Uint8Array(),bytesRead:0}]]);
}
const box=(x:number,y:number,r=1)=>({xMin:x-r,xMax:x+r,yMin:y-r,yMax:y+r,zMin:-5,zMax:5});
const off=(areas:Map<number,PathArea>)=>areas.get(0)!.nodes.filter(n=>n.switchedOff).map(n=>n.address.node);

describe('CPathFind road switches on the loaded nodes',()=>{
 test('a road cut in the box is cut both ways along it, up to and including the junction',()=>{
  const areas=road();
  switchRoadsOffInArea(areas,box(0,10),true,true,false);
  expect(off(areas)).toEqual([0,1,2,3]);
  // Switched back on, the same chain comes back.
  switchRoadsOffInArea(areas,box(0,10),false,true,false);
  expect(off(areas)).toEqual([]);
 });

 test('a car switch leaves ped nodes alone, and a ped switch car nodes',()=>{
  const areas=road();
  switchRoadsOffInArea(areas,box(5,5,6),true,false,false);
  expect(off(areas)).toEqual([7]);
 });

 test('nodes of behaviour 1 or 2 are never switched and stop the chain',()=>{
  const areas=road({2:{behaviour:1}});
  switchRoadsOffInArea(areas,box(0,10),true,true,false);
  expect(off(areas)).toEqual([0,1]);
 });

 test('back to original gives each node the switch it loaded with',()=>{
  const areas=road({0:{switchedOffOriginal:true,switchedOff:true}});
  switchRoadsOffInArea(areas,box(0,10),true,true,false);
  expect(off(areas)).toEqual([0,1,2,3]);
  switchRoadsOffInArea(areas,box(0,10),false,true,true);
  expect(off(areas)).toEqual([0]);
 });

 test('a freshly loaded area takes the stored switches',()=>{
  const areas=road();
  applyStoredSwitches(areas,0,[{...box(0,40),isOff:true,isCars:true},{...box(9,9),isOff:true,isCars:true}]);
  // The spur at 6 switches the junction too, and stops there.
  expect(off(areas)).toEqual([3,6]);
  applyStoredSwitches(areas,1,[{...box(0,0),isOff:true,isCars:true}]);
  expect(off(areas)).toEqual([3,6]);
 });

 test('the dont-wander mark goes on the nearest car node and all come off at once',()=>{
  const areas=road({4:{dontWander:true}});
  expect(markRoadNodeAsDontWander(areas,{x:1,y:19,z:0})?.address.node).toBe(2);
  expect(areas.get(0)!.nodes.filter(n=>n.dontWander).map(n=>n.address.node)).toEqual([2,4]);
  unmarkAllRoadNodesAsDontWander(areas);
  expect(areas.get(0)!.nodes.some(n=>n.dontWander)).toBe(false);
 });
});
