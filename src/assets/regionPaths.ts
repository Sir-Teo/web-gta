import {requireAsset} from './binary';
import {readImgIndex,readImgEntry} from './img';
import {readPathNodes,type PathArea} from './pathNodes';
import type {SceneRegion} from './sceneRegion';
export interface RegionPaths {land:Float32Array;pedestrian:Float32Array;water:Float32Array;areas:number;missingLinks:number;}
/** Keep whole native segments crossing the requested XY circle; coordinates in
 * output are renderer Y-up. Shared reverse edges draw once, not as duplicate lines. */
export function selectRegionPaths(areas:ReadonlyMap<number,PathArea>,region:SceneRegion):RegionPaths{
 requireAsset([region.x,region.y,region.radius].every(Number.isFinite)&&region.radius>0&&region.radius<=1e7,'Invalid path region.');
 const land:number[]=[],pedestrian:number[]=[],water:number[]=[],seen=new Set<string>();let missingLinks=0;
 for(const area of areas.values())for(const node of area.nodes)for(let i=0;i<node.linkCount;i++){
  const address=area.links[node.baseLink+i],target=areas.get(address.area)?.nodes[address.node];
  if(!target){missingLinks++;continue;}
  const a=node.position,b=target.position,dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((region.x-a[0])*dx+(region.y-a[1])*dy)/length)):0;
  if(Math.hypot(a[0]+t*dx-region.x,a[1]+t*dy-region.y)>region.radius)continue;
  const kind=node.kind==='pedestrian'?'pedestrian':node.water?'water':'land';
  const from=`${node.address.area}:${node.address.node}`,to=`${address.area}:${address.node}`,key=kind+':'+[from,to].sort().join('/');
  if(seen.has(key))continue;seen.add(key);requireAsset(seen.size<=100000,'Region path overlay exceeds the segment limit.');
  const output=kind==='land'?land:kind==='water'?water:pedestrian;
  output.push(a[0],a[2],-a[1],b[0],b[2],-b[1]);
 }
 return {land:new Float32Array(land),pedestrian:new Float32Array(pedestrian),water:new Float32Array(water),areas:areas.size,missingLinks};
}
export async function readRegionPaths(file:Blob,region:SceneRegion){
 const entries=(await readImgIndex(file)).filter(entry=>/^nodes\d+\.dat$/i.test(entry.name));
 requireAsset(entries.length<=64,'Too many exterior path areas.');
 const areas=new Map<number,PathArea>();let totalBytes=0,totalNodes=0;
 for(const entry of entries){
  requireAsset(entry.length<=4*1024*1024,'Path area exceeds the byte limit.');totalBytes+=entry.length;requireAsset(totalBytes<=16*1024*1024,'Path archive exceeds the byte limit.');
  const bytes=await readImgEntry(file,entry);
  const id=Number(/^nodes(\d+)\.dat$/i.exec(entry.name)![1]);requireAsset(!areas.has(id),'Duplicate exterior path area.');
  const area=readPathNodes(bytes,id);totalNodes+=area.nodes.length;requireAsset(totalNodes<=250000,'Path archive exceeds the node limit.');areas.set(id,area);
 }
 return selectRegionPaths(areas,region);
}
