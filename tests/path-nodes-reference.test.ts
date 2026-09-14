import {pathDirection} from '../src/assets/pathDirection';
import {pathLaneOffset} from '../src/assets/pathLaneOffset';
import {findNativeRoadRoute} from '../src/assets/pathRoute';
import {WORLD_REGIONS} from '../src/assets/worldRegions';
import {nativeShouldStopForPathLight,type NativeSignalRouteVehicle} from '../src/world/nativeSignalStop';
import {expect,test} from 'vitest';
import {openAsBlob} from 'node:fs';
import {readImgIndex,readImgEntry} from '../src/assets/img';
import {readPathNodes,type PathArea} from '../src/assets/pathNodes';
const root=process.env.GTA_CONTENT_DIR;
test.skipIf(!root)('native exterior path graph resolves every active destination and road navigation link',async()=>{
 const archive=await openAsBlob(root+'/gta3.img'),areas=new Map<number,PathArea>();
 for(const entry of await readImgIndex(archive)){
  const match=/^nodes(\d+)\.dat$/i.exec(entry.name);if(!match)continue;
  const area=Number(match[1]);expect(areas.has(area)).toBe(false);areas.set(area,readPathNodes(await readImgEntry(archive,entry),area));
 }
 expect(areas.size).toBe(64);let nodes=0,navigation=0,edges=0,crossArea=0,allowed=0,blocked=0,oneWay=0,nonEndpointAnchors=0;
 const checkedSignals=[0,0];
 const laneBranches=[0,0,0];let minWidth=Infinity,maxWidth=-Infinity,minOffset=Infinity,maxOffset=-Infinity;
 for(const area of areas.values()){
  nodes+=area.nodes.length;navigation+=area.navigation.length;
  for(const node of area.nodes)for(let i=0;i<node.linkCount;i++){
   const link=area.links[node.baseLink+i];expect(areas.get(link.area)?.nodes[link.node]?.address).toEqual(link);edges++;crossArea+=Number(link.area!==area.area);
   if(node.kind==='vehicle'&&!node.water){const navi=area.navigationLinks[node.baseLink+i];expect(navi).not.toBeNull();const navigation=areas.get(navi!.area)?.navigation[navi!.node];expect(navigation).toBeDefined();
    const direction=pathDirection(node.address,link,navigation!);if(direction.lanes){allowed++;if(!direction.reverseLanes)oneWay++;}else blocked++;if(!direction.anchorMatchesEndpoint)nonEndpointAnchors++;}
  }
  for(const [index,navi] of area.navigation.entries()){
   laneBranches[navi.oppositeLanes?0:navi.sameLanes?1:2]++;
   const offset=pathLaneOffset(navi);expect(Number.isFinite(offset)).toBe(true);
   minWidth=Math.min(minWidth,navi.width);maxWidth=Math.max(maxWidth,navi.width);
   minOffset=Math.min(minOffset,offset);maxOffset=Math.max(maxOffset,offset);
   expect(areas.get(navi.attachedTo.area)?.nodes[navi.attachedTo.node]?.address).toEqual(navi.attachedTo);
   if(navi.trafficLightState!==1&&navi.trafficLightState!==2)continue;
   const lengthSquared=navi.direction[0]**2+navi.direction[1]**2;expect(lengthSquared).toBeGreaterThan(0);
   const different=area.nodes.find(node=>node.address.area!==navi.attachedTo.area||node.address.node!==navi.attachedTo.node)!.address;
   const routeAddress=navi.trafficLightDirection?navi.attachedTo:different;
   // Synthetic approach positions exercise real imported geometry and metadata;
   // they are not captured native vehicle trajectories or inferred lane centers.
   for(const travelSign of [-1,1]){
    const distance=5*(travelSign===-1?1:-1)/lengthSquared;
    const vehicle:NativeSignalRouteVehicle={position:[navi.position[0]+navi.direction[0]*distance,navi.position[1]+navi.direction[1]*distance],appearance:'car',physicsStatus:true,
     current:{navigationAddress:{area:area.area,node:index},routeAddress,travelSign}};
    expect(nativeShouldStopForPathLight(areas,vehicle,navi.trafficLightState===1?12000:0)).toBe(true);
    expect(nativeShouldStopForPathLight(areas,vehicle,navi.trafficLightState===1?0:12000)).toBe(false);
   }
   checkedSignals[navi.trafficLightState-1]++;
  }
 }
 expect({allowed,blocked,oneWay,nonEndpointAnchors}).toEqual({allowed:48072,blocked:11548,oneWay:11524,nonEndpointAnchors:4});
 expect({nodes,navigation,edges,crossArea}).toEqual({nodes:68237,navigation:31466,edges:143622,crossArea:2424});
 expect(checkedSignals).toEqual([823,866]);
 expect(laneBranches).toEqual([24634,6820,12]);expect([minWidth,maxWidth]).toEqual([0,7.5]);
 expect(minOffset).toBeCloseTo(-.00925925925925919,12);expect(maxOffset).toBe(.5);
 const allLand=[...areas.values()].flatMap(area=>area.nodes.filter(node=>node.kind==='vehicle'&&!node.water));
 const endpoints=WORLD_REGIONS.map(region=>allLand.reduce((best,node)=>Math.hypot(node.position[0]-region.x,node.position[1]-region.y)<Math.hypot(best.position[0]-region.x,best.position[1]-region.y)?node:best));
 const expectedDistances=[8899,6266,6414,4079,6242,8842,2112,6791];
 for(const [index,end] of endpoints.slice(1).entries()){
  const result=findNativeRoadRoute(areas,endpoints[0].address,end.address);expect(result.status,WORLD_REGIONS[index+1].id).toBe('found');if(result.status!=='found')continue;
  expect(result.nodes[0]).toEqual(endpoints[0].address);expect(result.nodes.at(-1)).toEqual(end.address);
  expect(result.distance).toBe(expectedDistances[index]);expect(result.missingReferences).toBe(0);
  expect(new Set(result.nodes.map(a=>`${a.area}:${a.node}`)).size).toBe(result.nodes.length);
  expect(result.steps.some(step=>step.from.area!==step.to.area)).toBe(true);
  let distance=0;
  for(const step of result.steps){
   const area=areas.get(step.from.area)!,node=area.nodes[step.from.node],nav=areas.get(step.navigation.area)!.navigation[step.navigation.node];
   const slots=Array.from({length:node.linkCount},(_,i)=>node.baseLink+i);
   const slot=slots.find(i=>area.links[i].area===step.to.area&&area.links[i].node===step.to.node&&area.navigationLinks[i]?.area===step.navigation.area&&area.navigationLinks[i]?.node===step.navigation.node);
   expect(slot).toBeDefined();expect(area.lengths[slot!]).toBe(step.length);
   expect(pathDirection(step.from,step.to,nav).lanes).toBe(step.lanes);expect(step.lanes).toBeGreaterThan(0);distance+=step.length;
  }
  expect(distance).toBe(result.distance);
 }
},20000);
