import type {PathArea,PathNode} from './pathNodes';
import type {SceneRegion} from './sceneRegion';
import {findNativeRoadRoute} from './pathRoute';
import {readPathAreas} from './regionPaths';
/** Region centers are inspection inputs, not native spawn positions. Snap only
 * to land nodes within each region's radius and report the exact chosen IDs. */
export function selectRegionRoute(areas:ReadonlyMap<number,PathArea>,from:SceneRegion,to:SceneRegion){
 const nearest=(region:SceneRegion)=>{
  if(![region.x,region.y,region.radius].every(Number.isFinite)||region.radius<=0||region.radius>1e7)throw new Error('Invalid route region.');
  let best:PathNode|undefined,distance=Infinity;
  for(const area of areas.values())for(const node of area.nodes){
   if(node.kind!=='vehicle'||node.water)continue;
   const d=Math.hypot(node.position[0]-region.x,node.position[1]-region.y);
   if(d<=region.radius&&d<distance){best=node;distance=d;}
  }
  return best;
 };
 const start=nearest(from),end=nearest(to);
 if(!start||!end)return {status:'unavailable' as const,positions:new Float32Array(),steps:0,missingReferences:0};
 const route=findNativeRoadRoute(areas,start.address,end.address);
 if(route.status!=='found')return {...route,positions:new Float32Array(),steps:0};
 const positions=new Float32Array(route.steps.length*6);
 route.steps.forEach((step,i)=>{
  const a=areas.get(step.from.area)!.nodes[step.from.node].position,b=areas.get(step.to.area)!.nodes[step.to.node].position;
  positions.set([a[0],a[2],-a[1],b[0],b[2],-b[1]],i*6);
 });
 return {status:'found' as const,positions,steps:route.steps.length,distance:route.distance,missingReferences:route.missingReferences,start:{...start.address},end:{...end.address}};
}
export async function readRegionRoute(file:Blob,from:SceneRegion,to:SceneRegion){return selectRegionRoute(await readPathAreas(file),from,to);}
