import {expect,test} from 'vitest';
import {findNativeRoadRoute as route} from '../src/assets/pathRoute';
import {selectRegionRoute} from '../src/assets/regionRoute';
import type {PathArea,PathNode} from '../src/assets/pathNodes';
const address=(node:number)=>({area:0,node});
function graph(edges:[number,number,number][]){
 const count=1+Math.max(...edges.flatMap(([a,b])=>[a,b])),nodes:PathNode[]=[];
 const area:PathArea={area:0,nodes,vehicleCount:count,pedestrianCount:0,linkCount:edges.length,navigation:[],links:[],navigationLinks:[],lengths:new Uint8Array(edges.length),intersections:new Uint8Array(edges.length),bytesRead:0};
 for(let i=0;i<count;i++){
  const outgoing=edges.filter(([from])=>from===i),baseLink=area.links.length;
  nodes.push({address:address(i),position:[i,0,0],kind:'vehicle',baseLink,linkCount:outgoing.length,width:0,floodFill:0,flags:0,deadEnd:false,switchedOff:false,water:false,dontWander:false,spawnProbability:0,behaviour:0});
  for(const [,to,length] of outgoing){const index=area.navigation.length;area.lengths[index]=length;area.links.push(address(to));area.navigationLinks.push(address(index));area.navigation.push({position:[0,0],attachedTo:address(to),direction:[1,0],width:0,oppositeLanes:0,sameLanes:1,trafficLightDirection:false,trafficLightState:0,bridgeLights:false,flags:0});}
 }
 return new Map([[0,area]]);
}
test('finds lower native-length route, retaining exact navigation references and leaving input unchanged',()=>{
 const areas=graph([[0,2,20],[0,1,3],[1,2,4],[2,3,2]]),before=structuredClone(areas),result=route(areas,address(0),address(3));
 expect(result.status).toBe('found');if(result.status!=='found')return;
 expect(result.nodes.map(n=>n.node)).toEqual([0,1,2,3]);expect(result.distance).toBe(9);expect(result.steps.map(s=>s.navigation.node)).toEqual([1,2,3]);expect(result.steps.every(s=>s.lanes===1)).toBe(true);expect(areas).toEqual(before);
 result.nodes[0].node=9;result.steps[0].from.node=9;expect(areas).toEqual(before);
});
test('rejects forbidden lane directions, closed roads and water while choosing an available detour',()=>{
 const areas=graph([[0,1,1],[1,3,1],[0,2,3],[2,3,3]]),a=areas.get(0)!;
 a.navigation[0].sameLanes=0;let r=route(areas,address(0),address(3));expect(r.status==='found'&&r.distance).toBe(6);
 a.navigation[0].sameLanes=1;
  for(const field of ['water','switchedOff'] as const){a.nodes[1][field]=true;r=route(areas,address(0),address(3),{avoidSwitchedOff:true});expect(r.status==='found'&&r.distance).toBe(6);a.nodes[1][field]=false;}
 a.nodes[1].switchedOff=true;r=route(areas,address(0),address(3));expect(r.status==='found'&&r.distance).toBe(2);
 a.nodes[3].floodFill=1;expect(route(areas,address(0),address(3)).status).toBe('disconnected');
});
test('terminates on zero-length cycles and consistently resolves equal-cost alternatives',()=>{
 const areas=graph([[0,1,0],[1,0,0],[0,2,0],[1,3,1],[2,3,1]]);
 for(let i=0;i<3;i++){const r=route(areas,address(0),address(3));expect(r.status==='found'&&r.nodes.map(n=>n.node)).toEqual([0,1,3]);}
 const same=route(areas,address(0),address(0));expect(same.status==='found'&&same.distance).toBe(0);
});
test('reports limits and missing navigation instead of silently guessing permissions',()=>{
 const areas=graph([[0,1,1],[1,2,1]]);
 expect(route(areas,address(0),address(2),{maxVisited:1}).status).toBe('limit');
 for(const maxVisited of [0,-1,NaN,Infinity,.5,250001])expect(()=>route(areas,address(0),address(2),{maxVisited})).toThrow('limit');
 areas.get(0)!.navigationLinks[0]=null;expect(route(areas,address(0),address(2))).toMatchObject({status:'unavailable',missingReferences:1});
 expect(route(areas,address(0),{area:1,node:0}).status).toBe('unavailable');
});
test('distinguishes equal node indices across area boundaries and tolerates an unavailable alternate',()=>{
 const areas=graph([[0,1,3],[0,2,1]]),a=areas.get(0)!;
 const target={...a.nodes[1],address:{area:1,node:0},baseLink:0,linkCount:0};
 areas.set(1,{...a,area:1,nodes:[target],navigation:[],links:[],navigationLinks:[],lengths:new Uint8Array(),intersections:new Uint8Array()});
 a.links[0]=target.address;a.navigation[0].attachedTo=target.address;a.links[1]={area:2,node:0};
 const result=route(areas,address(0),target.address);expect(result.status).toBe('found');
 if(result.status==='found'){expect(result.distance).toBe(3);expect(result.missingReferences).toBe(1);expect(result.nodes).toEqual([address(0),target.address]);}
});
test('region inspection reports snapped IDs and preserves height through renderer-axis conversion',()=>{
 const areas=graph([[0,1,4]]);areas.get(0)!.nodes[0].position=[0,2,3];areas.get(0)!.nodes[1].position=[1,2,7];
 const result=selectRegionRoute(areas,{x:0,y:2,radius:.2},{x:1,y:2,radius:.2});
 expect(result.status).toBe('found');expect([...result.positions]).toEqual([0,3,-2,1,7,-2]);
 if(result.status==='found'){expect(result.start).toEqual(address(0));expect(result.end).toEqual(address(1));expect(result.steps).toBe(1);expect(result.distance).toBe(4);}
 expect(selectRegionRoute(areas,{x:0,y:20,radius:.2},{x:1,y:2,radius:.2}).status).toBe('unavailable');
 expect(()=>selectRegionRoute(areas,{x:NaN,y:2,radius:.2},{x:1,y:2,radius:.2})).toThrow('route region');
});
