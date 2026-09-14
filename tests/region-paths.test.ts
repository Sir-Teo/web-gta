import {expect,test} from 'vitest';
import {selectRegionPaths} from '../src/assets/regionPaths';
import type {PathArea,PathNode,PathAddress} from '../src/assets/pathNodes';
const node=(area:number,index:number,position:[number,number,number],kind:PathNode['kind']='vehicle',water=false):PathNode=>({address:{area,node:index},position,kind,water,baseLink:index,linkCount:1,width:0,floodFill:0,flags:0,deadEnd:false,switchedOff:false,dontWander:false,spawnProbability:0,behaviour:0});
const area=(id:number,nodes:PathNode[],links:PathAddress[]):PathArea=>({area:id,nodes,links,vehicleCount:0,pedestrianCount:0,linkCount:links.length,navigation:[],navigationLinks:[],lengths:new Uint8Array(),intersections:new Uint8Array(),bytesRead:0});
test('keeps crossing segments with exterior endpoints and converts native coordinates without flattening',()=>{
 const a=node(1,0,[-2,0,3]),b=node(2,0,[2,0,5]);
 const areas=new Map([[1,area(1,[a],[b.address])],[2,area(2,[b],[a.address])]]);
 const result=selectRegionPaths(areas,{x:0,y:0,radius:1});
 expect([...result.land]).toEqual([-2,3,-0,2,5,-0]);expect(result.areas).toBe(2);expect(result.missingLinks).toBe(0);
 expect(selectRegionPaths(areas,{x:0,y:3,radius:1}).land).toHaveLength(0);
 expect(a.position).toEqual([-2,0,3]);expect(b.position).toEqual([2,0,5]);
});
test('separates pedestrian and water edges and reports unresolved loaded-area destinations',()=>{
 const nodes=[node(0,0,[0,1,2],'pedestrian'),node(0,1,[0,-1,4],'vehicle',true),node(0,2,[0,0,3])];
 const areas=new Map([[0,area(0,nodes,[nodes[1].address,nodes[0].address,{area:63,node:12}])]]);
 const result=selectRegionPaths(areas,{x:0,y:0,radius:2});
 expect([...result.pedestrian]).toEqual([0,2,-1,0,4,1]);expect([...result.water]).toEqual([0,4,1,0,2,-1]);expect(result.land).toHaveLength(0);expect(result.missingLinks).toBe(1);
 for(const radius of [0,-1,Infinity,NaN])expect(()=>selectRegionPaths(areas,{x:0,y:0,radius})).toThrow('path region');
});
test('one-way arrows point along permitted travel only, with heights interpolated from native endpoints',()=>{
 const a=node(1,0,[-10,0,5]),b=node(2,0,[10,0,5]);
 const first=area(1,[a],[b.address]),second=area(2,[b],[a.address]);
 const navigation={attachedTo:b.address,sameLanes:2,oppositeLanes:0} as PathArea['navigation'][number];
 first.navigation=[navigation];first.navigationLinks=[{area:1,node:0}];second.navigationLinks=[{area:1,node:0}];
 const areas=new Map([[1,first],[2,second]]);
 for(const sign of [1,-1]){
  const result=selectRegionPaths(areas,{x:0,y:0,radius:1});expect(result.oneWay).toHaveLength(12);
  for(let i=0;i<12;i+=6){expect((result.oneWay[i+3]-result.oneWay[i])*sign).toBeGreaterThan(0);expect(result.oneWay[i+1]).toBe(5);expect(result.oneWay[i+4]).toBe(5);}
  navigation.sameLanes=0;navigation.oppositeLanes=2;
 }
 navigation.sameLanes=2;expect(selectRegionPaths(areas,{x:0,y:0,radius:1}).oneWay).toHaveLength(0);
});
