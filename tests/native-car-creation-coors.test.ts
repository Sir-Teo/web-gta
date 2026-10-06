import {expect,test} from 'vitest';
import type {PathArea,PathNode} from '../src/assets/pathNodes';
import {generateCarCreationCoors2,newCarCreationCache,thisNodeWillLeadIntoADeadEnd} from '../src/simulation/nativeCarCreationCoors';

/** A straight two-way road east along y = 0 from x = 5, a node every 20 units; node i links to i - 1 and i + 1. */
function road(count:number,z=(i:number)=>0):Map<number,PathArea>{
 const nodes:PathNode[]=[],links:{area:number;node:number}[]=[];
 for(let i=0;i<count;i++){
  const neighbours=[i-1,i+1].filter(j=>j>=0&&j<count);
  nodes.push({address:{area:0,node:i},position:[i*20+5,0,z(i)],kind:'vehicle',baseLink:links.length,linkCount:neighbours.length,width:0,floodFill:1,flags:0,
   deadEnd:false,switchedOff:false,water:false,dontWander:false,switchedOffOriginal:false,spawnProbability:15,behaviour:0});
  for(const j of neighbours)links.push({area:0,node:j});
 }
 const area={area:0,vehicleCount:count,pedestrianCount:0,linkCount:links.length,nodes,navigation:[],links,navigationLinks:links.map(()=>({area:0,node:0})),
  lengths:new Uint8Array(links.length),intersections:new Uint8Array(links.length),bytesRead:0} as unknown as PathArea;
 return new Map([[0,area]]);
}
/** rand() replaying a list, then 0. */
const rands=(...values:number[])=>{let i=0;return ()=>values[i++]??0;};
const request={position:{x:0,y:0,z:0},dirX:.707,dirY:.707,minDot:-1,dotAbove:true,inViewDistance:160,outOfViewDistance:160,avoidSwitchedOff:false,noBoats:false};

test('the walk takes the first link crossing the circle, seen or not when both circles are the same',()=>{
 const areas=road(12);
 // No boat start (1 & 15), the cache's first node (1 & 3), then each node's links taken in order, and node1 the way
 // it walked (8).
 const world={nowMs:0,rand:rands(1,1,0,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0, 0,0, 8),sphereVisible:()=>false};
 const hit=generateCarCreationCoors2(areas,newCarCreationCache(),request,world)!;
 expect(hit.position.x).toBeCloseTo(160,4);expect(hit.position.y).toBe(0);
 expect([hit.node1.address.node,hit.node2.address.node].sort((a,b)=>a-b)).toEqual([7,8]);
 // The point is node1 + t × (node2 − node1).
 expect(hit.node1.position[0]+hit.t*(hit.node2.position[0]-hit.node1.position[0])).toBeCloseTo(160,4);
});

test('a crossing on a link climbing more than half its length is passed over, and so is the walk past 230 units',()=>{
 // The link from node 7 to 8 climbs 15 in 20.
 const steep=road(14,i=>i>=8?15:0);
 const world=()=>({nowMs:0,rand:rands(1,1),sphereVisible:()=>false});
 expect(generateCarCreationCoors2(steep,newCarCreationCache(),request,world())).toBeUndefined();
 // A circle of 300 is never reached inside 230 units of road.
 expect(generateCarCreationCoors2(road(20),newCarCreationCache(),{...request,inViewDistance:300,outOfViewDistance:300},world())).toBeUndefined();
});

test('the in-view circle needs a visible crossing and the out-of-view one a hidden one',()=>{
 const areas=road(12),near={...request,inViewDistance:60,outOfViewDistance:160};
 // Nothing is visible: the 60 crossing is passed over and the car goes at 160.
 const hidden=generateCarCreationCoors2(areas,newCarCreationCache(),near,{nowMs:0,rand:rands(1,1),sphereVisible:()=>false})!;
 expect(hidden.position.x).toBeCloseTo(160,4);
 // Everything is visible: the 60 crossing is taken.
 const seen=generateCarCreationCoors2(areas,newCarCreationCache(),near,{nowMs:0,rand:rands(1,1),sphereVisible:()=>true})!;
 expect(seen.position.x).toBeCloseTo(60,4);
});

test('a bearing outside the wanted cone fails the call',()=>{
 const areas=road(12);
 expect(generateCarCreationCoors2(areas,newCarCreationCache(),{...request,dirX:-1,dirY:0,minDot:.5},{nowMs:0,rand:rands(1,1),sphereVisible:()=>false})).toBeUndefined();
});

test('a road whose only way on ends leads into a dead end; a fork does not',()=>{
 const areas=road(5),nodes=areas.get(0)!.nodes;
 expect(thisNodeWillLeadIntoADeadEnd(areas,nodes[2],nodes[1])).toBe(true);
 expect(thisNodeWillLeadIntoADeadEnd(areas,nodes[1],nodes[2])).toBe(true);
 // A fork: node 2 gains a second way on (to node 4's neighbour list's end), so there is no single onward road.
 const fork=road(5),area=fork.get(0)!,n2=area.nodes[2];
 area.links.splice(n2.baseLink+n2.linkCount,0,{area:0,node:4});n2.linkCount++;
 for(const n of area.nodes)if(n.address.node>2)n.baseLink++;
 expect(thisNodeWillLeadIntoADeadEnd(fork,n2,area.nodes[1])).toBe(false);
});
