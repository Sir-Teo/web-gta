import type {PathArea,PathNode} from '../assets/pathNodes';
import {findNthNodeClosestToCoors} from './nativeScriptCarNodes';
/* CPathFind's switches on the loaded path nodes, pinned gta-reversed PathFind.cpp (all reversed):
 * - SwitchRoadsOffInAreaForOneRegion (0x452820): each node of the kind inside the box is set to the switch (or back
 *   to how it loaded). Nodes whose behaviour is 1 or 2 are never switched (HasToBeSwitchedOff). Each switch runs on
 *   along its road through SwitchOffNodeAndNeighbours (0x452160): the chain of switchable neighbours not yet set is
 *   followed both ways until a junction (a node with more than two switchable neighbours). So a road cut inside the
 *   box is cut to its next junction.
 * - LoadPathFindData: an area keeps each node's flag as it loaded (m_isSwitchedOffOriginal), then takes every
 *   stored switch.
 * - MarkRoadNodeAsDontWander (0x450560): the car node nearest the point (FindNodeClosestToCoors over land nodes)
 *   stops being wandered. UnMarkAllRoadNodesAsDontWander (0x44D400) clears the flag on every loaded car node, the
 *   ones the files set included.
 * Coordinates are native. */
export interface SwitchBox {xMin:number;xMax:number;yMin:number;yMax:number;zMin:number;zMax:number}

const hasToBeSwitchedOff=(node:PathNode)=>node.behaviour!==1&&node.behaviour!==2;
function linkedNodes(areas:ReadonlyMap<number,PathArea>,node:PathNode){
 const area=areas.get(node.address.area),out:PathNode[]=[];if(!area)return out;
 for(let k=0;k<node.linkCount;k++){
  const address=area.links[node.baseLink+k],linked=address&&areas.get(address.area)?.nodes[address.node];
  if(linked)out.push(linked);
 }
 return out;
}
const countSwitchable=(areas:ReadonlyMap<number,PathArea>,node:PathNode)=>linkedNodes(areas,node).filter(hasToBeSwitchedOff).length;

/** SwitchOffNodeAndNeighbours: set the node, and hand back up to two switchable neighbours to go on to, unless the
 * node is a junction. The source's check counts the node's own neighbours each time, as reversed. */
function switchOffNodeAndNeighbours(areas:ReadonlyMap<number,PathArea>,node:PathNode,switchTo:boolean,backToOriginal:boolean,wantSecond:boolean){
 node.switchedOff=backToOriginal?node.switchedOffOriginal:switchTo;
 const next:PathNode[]=[];
 if(countSwitchable(areas,node)>2)return next;
 for(const linked of linkedNodes(areas,node)){
  if(!hasToBeSwitchedOff(linked)||linked.switchedOff===switchTo)continue;
  if(!next.length)next.push(linked);
  else if(wantSecond)next[1]=linked;
 }
 return next;
}

/** SwitchRoadsOffInAreaForOneRegion over one loaded area. */
export function switchRoadsOffInAreaForOneRegion(areas:ReadonlyMap<number,PathArea>,areaId:number,box:SwitchBox,switchOff:boolean,cars:boolean,backToOriginal:boolean){
 const area=areas.get(areaId);if(!area)return;
 const [start,end]=cars?[0,area.vehicleCount]:[area.vehicleCount,area.nodes.length];
 for(let i=start;i<end;i++){
  const node=area.nodes[i],[x,y,z]=node.position;
  if(x<box.xMin||x>box.xMax||y<box.yMin||y>box.yMax||z<box.zMin||z>box.zMax)continue;
  if(!hasToBeSwitchedOff(node)||node.switchedOff===(backToOriginal?node.switchedOffOriginal:switchOff))continue;
  const [next1,next2]=switchOffNodeAndNeighbours(areas,node,switchOff,backToOriginal,true);
  // Each way along the road until the chain stops handing on a node.
  for(const first of [next1,next2]){
   let guard=0;
   for(let at:PathNode|undefined=first;at&&guard<65536;guard++)at=switchOffNodeAndNeighbours(areas,at,switchOff,backToOriginal,false)[0];
  }
 }
}
/** SwitchRoadsOffInArea's node pass, over every loaded area. */
export function switchRoadsOffInArea(areas:ReadonlyMap<number,PathArea>,box:SwitchBox,switchOff:boolean,cars:boolean,backToOriginal:boolean){
 for(const id of areas.keys())switchRoadsOffInAreaForOneRegion(areas,id,box,switchOff,cars,backToOriginal);
}
/** LoadPathFindData's end: the stored switches onto a freshly loaded area. */
export function applyStoredSwitches(areas:ReadonlyMap<number,PathArea>,areaId:number,switches:readonly (SwitchBox&{isOff:boolean;isCars:boolean})[]){
 for(const s of switches)switchRoadsOffInAreaForOneRegion(areas,areaId,s,s.isOff,s.isCars,false);
}
/** MarkRoadNodeAsDontWander. */
export function markRoadNodeAsDontWander(areas:ReadonlyMap<number,PathArea>,point:{x:number;y:number;z:number}){
 const node=findNthNodeClosestToCoors(areas,point,0,{kind:'vehicle',maxDistance:999999.88});
 if(node)node.dontWander=true;
 return node;
}
/** UnMarkAllRoadNodesAsDontWander. */
export function unmarkAllRoadNodesAsDontWander(areas:ReadonlyMap<number,PathArea>){
 for(const area of areas.values())for(let i=0;i<area.vehicleCount;i++)area.nodes[i].dontWander=false;
}
