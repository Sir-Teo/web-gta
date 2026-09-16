import {pathDirection} from '../assets/pathDirection';
import type {PathArea,PathNode,NavigationNode} from '../assets/pathNodes';
import {angleDelta,clamp} from '../core/math';
export interface TrafficLink {from:PathNode;to:PathNode;navigation:NavigationNode;start:{x:number;z:number};end:{x:number;z:number};length:number;dx:number;dz:number;}
/** `closed` also admits switched-off and don't-wander nodes, which only keep random traffic out (mission cars still use them). */
export function trafficLinks(areas:ReadonlyMap<number,PathArea>,from:PathNode,closed=false):TrafficLink[]{
 const area=areas.get(from.address.area);if(!area)return [];
 const allowed=(n:PathNode)=>n.kind==='vehicle'&&!n.water&&(closed||!n.switchedOff&&!n.dontWander);
 if(!allowed(from))return [];
 const links:TrafficLink[]=[];
 for(let slot=from.baseLink;slot<from.baseLink+from.linkCount;slot++){
  const address=area.links[slot],to=address&&areas.get(address.area)?.nodes[address.node],ref=area.navigationLinks[slot],navigation=ref&&areas.get(ref.area)?.navigation[ref.node];
  // Mission cars may also drive against one-way lanes, keeping to the road centre.
  if(!to||!allowed(to)||!navigation||!closed&&!pathDirection(from.address,to.address,navigation).lanes)continue;
  const length=Math.hypot(to.position[0]-from.position[0],to.position[1]-from.position[1]);if(length<3||Math.abs(to.position[2]-from.position[2])/length>.3)continue;
  const dx=(to.position[0]-from.position[0])/length,dz=-(to.position[1]-from.position[1])/length;
  // Browser policy: innermost right-hand lane, with 3.2 m lane spacing.
  // On one-way links center the selected lane within the available carriageway.
  const direction=pathDirection(from.address,to.address,navigation),offset=!direction.lanes?0:direction.reverseLanes?1.6:-(direction.lanes-1)*1.6;
  const point=(n:PathNode)=>({x:n.position[0]-dz*offset,z:-n.position[1]+dx*offset});
  links.push({from,to,navigation,start:point(from),end:point(to),length,dx,dz});
 }
 return links;
}
export function trafficSteering(heading:number,direction:{x:number;z:number}){
 const error=angleDelta(heading,Math.atan2(-direction.x,-direction.z));
 return {error,steering:-Math.sign(error)*Math.sqrt(clamp(Math.abs(error)*1.4,0,1))};
}
/** CPathFind::DoPathSearch stand-in over the loaded car nodes: A* from `start` to the car node nearest `goal`, as a chain of links. */
export function findTrafficRoute(areas:ReadonlyMap<number,PathArea>,start:PathNode,goal:{x:number;y?:number;z:number},maxExpanded=4000,closedRoads=true):TrafficLink[]|undefined{
 const key=(n:PathNode)=>n.address.area*65536+n.address.node;
 let target:PathNode|undefined,best=Infinity;
 for(const area of areas.values())for(const node of area.nodes){if(node.kind!=='vehicle'||node.water||!closedRoads&&(node.switchedOff||node.dontWander)||!node.linkCount)continue;const d=Math.hypot(node.position[0]-goal.x,-node.position[1]-goal.z,goal.y===undefined?0:node.position[2]-goal.y);if(d<best){best=d;target=node;}}
 if(!target)return undefined;
 const h=(n:PathNode)=>Math.hypot(n.position[0]-target!.position[0],n.position[1]-target!.position[1]);
 const open:{node:PathNode;f:number}[]=[{node:start,f:h(start)}],g=new Map([[key(start),0]]),came=new Map<number,TrafficLink>(),closed=new Set<number>();
 let expanded=0;
 while(open.length&&expanded++<maxExpanded){
  let index=0;for(let i=1;i<open.length;i++)if(open[i].f<open[index].f)index=i;
  const {node}=open.splice(index,1)[0],k=key(node);if(closed.has(k))continue;closed.add(k);
  if(node===target){const route:TrafficLink[]=[];for(let at=k;came.has(at);){const link=came.get(at)!;route.unshift(link);at=key(link.from);}return route;}
  for(const link of trafficLinks(areas,node,closedRoads)){
   const nk=key(link.to),cost=g.get(k)!+link.length;if(closed.has(nk)||cost>=(g.get(nk)??Infinity))continue;
   g.set(nk,cost);came.set(nk,link);open.push({node:link.to,f:cost+h(link.to)});
  }
 }
 return undefined;
}
