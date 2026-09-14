import {pathDirection} from './pathDirection';
import type {PathAddress,PathArea,PathNode} from './pathNodes';

export interface RoadRouteStep {from:PathAddress;to:PathAddress;navigation:PathAddress;length:number;lanes:number;}
export type RoadRouteResult={status:'found';nodes:PathAddress[];steps:RoadRouteStep[];distance:number;visited:number;missingReferences:number}|
 {status:'unavailable'|'disconnected'|'limit';visited:number;missingReferences:number};
const key=(a:PathAddress)=>a.area*65536+a.node;
const addressValid=(a:PathAddress)=>Number.isInteger(a.area)&&a.area>=0&&a.area<64&&Number.isInteger(a.node)&&a.node>=0&&a.node<65536;
type Candidate={address:PathAddress;distance:number;order:number};
const before=(a:Candidate,b:Candidate)=>a.distance<b.distance||a.distance===b.distance&&a.order<b.order;
/** Browser road-graph Dijkstra search. Uses native active links, byte lengths
 * and lane direction permissions; does not reproduce DoPathSearch's internal
 * bucket order, search limits or waypoint truncation. No input graph mutation.
 * Missing navigation never becomes a guessed two-way connection. */
export function findNativeRoadRoute(areas:ReadonlyMap<number,PathArea>,start:PathAddress,end:PathAddress,
 {maxVisited=65536,avoidSwitchedOff=false}:{maxVisited?:number;avoidSwitchedOff?:boolean}={}):RoadRouteResult {
 if(!Number.isInteger(maxVisited)||maxVisited<1||maxVisited>250000)throw new Error('Invalid road route search limit.');
 const nodeAt=(address:PathAddress):PathNode|undefined=>addressValid(address)?areas.get(address.area)?.nodes[address.node]:undefined;
 // DoPathSearch does not filter this flag. Callers may explicitly request
 // closure avoidance; route existence by itself never grants spawn permission.
 const allowed=(node:PathNode)=>node.kind==='vehicle'&&!node.water&&(!avoidSwitchedOff||!node.switchedOff);
 const first=nodeAt(start),last=nodeAt(end);
 if(!first||!last)return {status:'unavailable',visited:0,missingReferences:0};
 if(!allowed(first)||!allowed(last)||first.floodFill!==last.floodFill)return {status:'disconnected',visited:0,missingReferences:0};
 const heap:Candidate[]=[],distances=new Map<number,number>([[key(start),0]]),previous=new Map<number,RoadRouteStep>();
 let order=0,visited=0,missingReferences=0;
 const push=(address:PathAddress,distance:number)=>{
  const item={address,distance,order:order++};let i=heap.length;heap.push(item);
  while(i){const parent=(i-1)>>1;if(!before(item,heap[parent]))break;heap[i]=heap[parent];i=parent;}heap[i]=item;
 };
 const pop=()=>{
  const result=heap[0],tail=heap.pop()!;
  if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&before(heap[child+1],heap[child]))child++;if(!before(heap[child],tail))break;heap[i]=heap[child];i=child;}heap[i]=tail;}
  return result;
 };
 push(first.address,0);
 while(heap.length){
  const current=pop(),currentKey=key(current.address);
  if(current.distance!==distances.get(currentKey))continue;
  if(visited>=maxVisited)return {status:'limit',visited,missingReferences};
  visited++;
  if(currentKey===key(end)){
   const steps:RoadRouteStep[]=[];let at=currentKey;
   while(at!==key(start)){const step=previous.get(at)!;steps.push(step);at=key(step.from);}steps.reverse();
   return {status:'found',nodes:[{...first.address},...steps.map(step=>({...step.to}))],steps,distance:current.distance,visited,missingReferences};
  }
  const area=areas.get(current.address.area)!,node=area.nodes[current.address.node];
  for(let slot=node.baseLink;slot<node.baseLink+node.linkCount;slot++){
   const targetAddress=area.links[slot],target=targetAddress&&nodeAt(targetAddress);
   if(!target){missingReferences++;continue;}if(!allowed(target)||target.floodFill!==first.floodFill)continue;
   const reference=area.navigationLinks[slot],navigation=reference&&!(reference.area===63&&reference.node===1023)&&areas.get(reference.area)?.navigation[reference.node];
   if(!navigation){missingReferences++;continue;}
   const {lanes}=pathDirection(node.address,target.address,navigation);if(!lanes)continue;
   const length=area.lengths[slot];if(length===undefined){missingReferences++;continue;}
   const distance=current.distance+length,targetKey=key(target.address);
   if(distance>=(distances.get(targetKey)??Infinity))continue;
   distances.set(targetKey,distance);previous.set(targetKey,{from:{...node.address},to:{...target.address},navigation:{...reference!},length,lanes});push(target.address,distance);
  }
 }
 return {status:missingReferences?'unavailable':'disconnected',visited,missingReferences};
}
