/** Audit the native exterior path graph already present in the world IMG.
 * node scripts/content/audit-paths.mjs /absolute/content-depot */
import {openAsBlob} from 'node:fs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'rolldown';
const [input,...extra]=process.argv.slice(2);if(!input||extra.length)throw new Error('Usage: node scripts/content/audit-paths.mjs /absolute/content-depot');
const depot=resolve(input),temp=await mkdtemp(join(tmpdir(),'web-gta-path-audit-'));
try{
 await writeFile(join(temp,'entry.ts'),['pathNodes','pathDirection','pathLaneOffset','pathRoute','img','worldRegions'].map(name=>`export * from ${JSON.stringify(resolve('src/assets',name+'.ts'))};`).join('\n'));
 await build({input:join(temp,'entry.ts'),platform:'node',output:{file:join(temp,'readers.mjs'),format:'esm'}});
 const {pathDirection,pathLaneOffset,findNativeRoadRoute,readPathNodes,readImgIndex,readImgEntry,WORLD_REGIONS}=await import(pathToFileURL(join(temp,'readers.mjs')));
 const archive=await openAsBlob(join(depot,'gta3.img')),entries=await readImgIndex(archive),areas=new Map(),files=[];
 for(const entry of entries){
  const match=/^nodes(\d+)\.dat$/i.exec(entry.name);if(!match)continue;
  const id=Number(match[1]);if(areas.has(id))throw new Error(`Duplicate path area ${id}`);
  const bytes=await readImgEntry(archive,entry),area=readPathNodes(bytes,id);areas.set(id,area);
  files.push({name:entry.name,area:id,bytes:bytes.length,payloadBytes:area.bytesRead,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
 if(areas.size!==64)throw new Error(`Expected all 64 exterior path areas, found ${areas.size}.`);
 const issues=[];let issueCount=0,edges=0,crossAreaEdges=0,roadEdges=0,waterEdges=0,allowedLandDirections=0,blockedLandDirections=0,oneWayLandDirections=0,nonEndpointAnchors=0;
 const issue=(kind,source,target)=>{issueCount++;if(issues.length<200)issues.push({kind,source,target});};
 const hasNode=address=>address&&areas.get(address.area)?.nodes[address.node];
 for(const area of areas.values()){
  for(const node of area.nodes)for(let i=node.baseLink;i<node.baseLink+node.linkCount;i++){
   const target=area.links[i];edges++;if(target.area!==area.area)crossAreaEdges++;
   if(!hasNode(target))issue('missing-node',node.address,target);
   if(node.kind!=='vehicle')continue;
   if(node.water){waterEdges++;continue;}roadEdges++;
   const navi=area.navigationLinks[i];
   const navigation=navi&&areas.get(navi.area)?.navigation[navi.node];
   if(!navigation)issue('missing-land-navigation',node.address,navi);
   else{
    const direction=pathDirection(node.address,target,navigation);
    if(!direction.anchorMatchesEndpoint)nonEndpointAnchors++;
    if(!direction.lanes)blockedLandDirections++;
    else{allowedLandDirections++;if(!direction.reverseLanes)oneWayLandDirections++;}
   }
  }
  for(let i=0;i<area.navigation.length;i++)if(!hasNode(area.navigation[i].attachedTo))issue('missing-navigation-anchor',{area:area.area,node:i},area.navigation[i].attachedTo);
 }
 const nodes=[...areas.values()].flatMap(area=>area.nodes),navigation=[...areas.values()].flatMap(area=>area.navigation);
 const signalGroups=[0,0,0,0];for(const navi of navigation)signalGroups[navi.trafficLightState]++;
 const laneLayout={oppositePresent:0,sameOnly:0,noLanes:0,negativeWidths:0,widthRange:null,offsetRange:null};
 for(const navi of navigation){
  laneLayout[navi.oppositeLanes?'oppositePresent':navi.sameLanes?'sameOnly':'noLanes']++;
  if(navi.width<0)laneLayout.negativeWidths++;
  const offset=pathLaneOffset(navi);
  laneLayout.widthRange=laneLayout.widthRange?[Math.min(laneLayout.widthRange[0],navi.width),Math.max(laneLayout.widthRange[1],navi.width)]:[navi.width,navi.width];
  laneLayout.offsetRange=laneLayout.offsetRange?[Math.min(laneLayout.offsetRange[0],offset),Math.max(laneLayout.offsetRange[1],offset)]:[offset,offset];
 }
 const regions=WORLD_REGIONS.map(region=>{
  const nearby=nodes.filter(n=>Math.hypot(n.position[0]-region.x,n.position[1]-region.y)<=region.radius);
  const road=nearby.filter(n=>n.kind==='vehicle'&&!n.water).sort((a,b)=>Math.hypot(a.position[0]-region.x,a.position[1]-region.y)-Math.hypot(b.position[0]-region.x,b.position[1]-region.y));
  return {id:region.id,landVehicleNodes:road.length,waterNodes:nearby.filter(n=>n.kind==='vehicle'&&n.water).length,pedestrianNodes:nearby.filter(n=>n.kind==='pedestrian').length,nearestLandVehicleNode:road[0]?{address:road[0].address,position:road[0].position}:null};
 });
 const report={checkedAt:new Date().toISOString(),archive:join(depot,'gta3.img'),files:files.sort((a,b)=>a.area-b.area),counts:{areas:areas.size,nodes:nodes.length,vehicleNodes:nodes.filter(n=>n.kind==='vehicle').length,pedestrianNodes:nodes.filter(n=>n.kind==='pedestrian').length,navigationNodes:navigation.length,edges,crossAreaEdges,landVehicleEdges:roadEdges,waterEdges,allowedLandDirections,blockedLandDirections,oneWayLandDirections,nonEndpointAnchors,signalGroups,signalDirectionFlags:navigation.filter(n=>n.trafficLightDirection).length},issueCount,issues,regions};
 report.laneLayout=laneLayout;
 const origin=regions.find(region=>region.id==='grove-street');
 report.routes=regions.filter(region=>region!==origin).map(region=>{
  if(!origin?.nearestLandVehicleNode||!region.nearestLandVehicleNode)return {from:origin?.id,to:region.id,status:'unavailable'};
  const route=findNativeRoadRoute(areas,origin.nearestLandVehicleNode.address,region.nearestLandVehicleNode.address);
  return {from:origin.id,to:region.id,status:route.status,visited:route.visited,missingReferences:route.missingReferences,...route.status==='found'?{distance:route.distance,steps:route.steps.length,crossAreaSteps:route.steps.filter(step=>step.from.area!==step.to.area).length}:{} };
 });
 await writeFile(join(depot,'path-content.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({counts:report.counts,laneLayout,issueCount,issues:issues.slice(0,5),regions,routes:report.routes},null,2));
 if(issueCount)process.exitCode=1;
}finally{await rm(temp,{recursive:true,force:true});}
