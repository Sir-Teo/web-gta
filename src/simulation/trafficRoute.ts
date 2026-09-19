import {pathDirection} from '../assets/pathDirection';
import type {PathArea,PathNode,NavigationNode} from '../assets/pathNodes';
import {oneWayLaneOffset,type TravelLink} from '../vehicle/nativeCarCtrl';
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
/** CPathFind::DoPathSearch stand-in over the loaded car nodes: A* from `start` to the car node nearest `goal`, as a chain of links. */
/** CPathFind::FindNodeClosestToCoorsFavourDirection (0x44FCE0, reversed): the car node with the least
 * |dx| + |dy| + 3|dz| from `position`, less 20 × (cos(angle to it from `forward`) − 1), so a node behind costs up to 40
 * more. Native coordinates. */
export function findNodeClosestToCoorsFavourDirection(areas:ReadonlyMap<number,PathArea>,position:{x:number;y:number;z:number},forward:{x:number;y:number}){
 const fl=Math.hypot(forward.x,forward.y)||1,fx=forward.x/fl,fy=forward.y/fl;
 let best:PathNode|undefined,score=Infinity;
 for(const area of areas.values())for(const node of area.nodes){
  if(node.kind!=='vehicle'||node.water||!node.linkCount)continue;
  const dx=node.position[0]-position.x,dy=node.position[1]-position.y,dz=node.position[2]-position.z,base=Math.abs(dx)+Math.abs(dy)+3*Math.abs(dz);
  if(base>=score)continue;
  const l=Math.hypot(dx,dy)||1,s=base-((fx*dx+fy*dy)/l-1)*20;
  if(s>score)continue;
  score=s;best=node;
 }
 return best;
}
/** CCarCtrl::JoinCarWithRoadSystem (SA's is a stub; Vice City's): the node FindNodeClosestToCoorsFavourDirection picks
 * and its nearest neighbour, ordered along the car's heading, as the link it drives. */
export function joinCarWithRoadSystem(areas:ReadonlyMap<number,PathArea>,position:{x:number;y:number;z:number},forward:{x:number;y:number}):TrafficLink|undefined{
 const node=findNodeClosestToCoorsFavourDirection(areas,position,forward);if(!node)return undefined;
 const neighbours=trafficLinks(areas,node,true).map(l=>l.to);
 let prev:PathNode|undefined,best=Infinity;
 for(const n of neighbours){const d=Math.hypot(n.position[0]-node.position[0],n.position[1]-node.position[1]);if(d<best){best=d;prev=n;}}
 if(!prev)return undefined;
 const [from,to]=(node.position[0]-prev.position[0])*forward.x+(node.position[1]-prev.position[1])*forward.y<0?[node,prev]:[prev,node];
 return trafficLinks(areas,from,true).find(l=>l.to===to);
}
/** The goal is the node CPathFind::FindNodeClosestToCoors picks: least |dx| + |dy| + 3|dz| (the metric of SA's reversed
 * FindNodeClosestToCoorsFavourDirection and of Vice City's FindNodeClosestToCoors), so a road above or below the goal
 * loses to one level with it. */
export function findTrafficRoute(areas:ReadonlyMap<number,PathArea>,start:PathNode,goal:{x:number;y?:number;z:number},maxExpanded=4000,closedRoads=true):TrafficLink[]|undefined{
 const key=(n:PathNode)=>n.address.area*65536+n.address.node;
 let target:PathNode|undefined,best=Infinity;
 for(const area of areas.values())for(const node of area.nodes){if(node.kind!=='vehicle'||node.water||!closedRoads&&(node.switchedOff||node.dontWander)||!node.linkCount)continue;const d=Math.abs(node.position[0]-goal.x)+Math.abs(-node.position[1]-goal.z)+(goal.y===undefined?0:3*Math.abs(node.position[2]-goal.y));if(d<best){best=d;target=node;}}
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
/** A traffic link as CCarCtrl travels it (native space; see nativeCarCtrl.ts): the navigation point, its direction
 * turned to the direction of travel from `from` to `to`, and its OneWayLaneOffset. */
export function travelLink(link:TrafficLink):TravelLink{
 const n=link.navigation,along=(link.to.position[0]-link.from.position[0])*n.direction[0]+(link.to.position[1]-link.from.position[1])*n.direction[1]>=0?1:-1;
 return {position:{x:n.position[0],y:n.position[1]},forward:{x:n.direction[0]*along,y:n.direction[1]*along},laneOffset:oneWayLaneOffset(n)};
}
