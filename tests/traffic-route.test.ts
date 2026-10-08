import {expect,test} from 'vitest';
import {findTrafficRoute,trafficLinks} from '../src/simulation/trafficRoute';
import type {PathNode,PathArea} from '../src/assets/pathNodes';
const node=(id:number,x:number):PathNode=>({address:{area:0,node:id},position:[x,0,0],kind:'vehicle',baseLink:id,linkCount:1,width:5,floodFill:0,flags:0,deadEnd:false,switchedOff:false,switchedOffOriginal:false,water:false,dontWander:false,spawnProbability:15,behaviour:0});
function graph(){
 const nodes=[node(0,0),node(1,20)];
 const area:PathArea={area:0,nodes,vehicleCount:2,pedestrianCount:0,linkCount:2,navigation:[{position:[10,0],attachedTo:nodes[1].address,direction:[1,0],width:5,sameLanes:1,oppositeLanes:1,trafficLightDirection:false,trafficLightState:0,bridgeLights:false,flags:0}],links:[nodes[1].address,nodes[0].address],navigationLinks:[{area:0,node:0},{area:0,node:0}],lengths:new Uint8Array([20,20]),intersections:new Uint8Array(2),bytesRead:0};
 return new Map([[0,area]]);
}
test('opposing traffic uses separate right-hand lanes and respects one-way permissions',()=>{
 const areas=graph(),area=areas.get(0)!;
 expect(trafficLinks(areas,area.nodes[0])[0].start.z).toBe(1.6);
 expect(trafficLinks(areas,area.nodes[1])[0].start.z).toBe(-1.6);
 area.navigation[0].oppositeLanes=0;
 expect(trafficLinks(areas,area.nodes[0])[0].start.z).toBeCloseTo(0);
 expect(trafficLinks(areas,area.nodes[1])).toEqual([]);
});
test('missing navigation, water, closures and pedestrian links never become traffic routes',()=>{
 const areas=graph(),area=areas.get(0)!;
 for(const field of ['water','switchedOff','dontWander'] as const){area.nodes[1][field]=true;expect(trafficLinks(areas,area.nodes[0])).toEqual([]);area.nodes[1][field]=false;}
 area.nodes[1].kind='pedestrian';expect(trafficLinks(areas,area.nodes[0])).toEqual([]);area.nodes[1].kind='vehicle';
 area.navigationLinks[0]=null;expect(trafficLinks(areas,area.nodes[0])).toEqual([]);
});


test('a short or steep link is still a road: the bank down into the flood channel is a 1.5 grade',()=>{
 const areas=graph(),area=areas.get(0)!;
 area.nodes[1].position=[5,0,-7.3];expect(trafficLinks(areas,area.nodes[0],true).map(l=>l.to)).toEqual([area.nodes[1]]);
 area.nodes[1].position=[2.5,0,0];expect(trafficLinks(areas,area.nodes[0],true)[0].length).toBeCloseTo(2.5);
 area.nodes[1].position=[0,0,3];expect(trafficLinks(areas,area.nodes[0],true)).toEqual([]);
});

test('pursuit destination distinguishes an overpass from the nearby street below',()=>{
 const areas=graph(),area=areas.get(0)!,start=area.nodes[0],bridge=area.nodes[1],street=node(2,17);
 start.position=[-100,0,0];start.linkCount=2;bridge.position=[20,0,15];bridge.baseLink=2;street.baseLink=3;
 area.nodes.push(street);area.links=[bridge.address,street.address,start.address,start.address];area.navigationLinks=Array.from({length:4},()=>({area:0,node:0}));
 expect(findTrafficRoute(areas,start,{x:20,z:0})?.at(-1)?.to).toBe(bridge);
 expect(findTrafficRoute(areas,start,{x:20,y:0,z:0})?.at(-1)?.to).toBe(street);
});
