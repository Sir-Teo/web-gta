import type {PathArea,PathNode} from '../assets/pathNodes';
import {findNthNodeClosestToCoors} from './nativeScriptCarNodes';
/* CCarCtrl::GenerateCarCreationCoors2 (PC 0x424210, a raw call in gta-reversed), as the iOS executable has it
 * (0x10018d028), over the loaded car path areas in native coordinates:
 * - every 5 s, or once the centre has moved 10 units, Find2NodesForCarCreation caches the two nodes to start from,
 *   once passing over switched-off nodes and once not;
 * - one call in sixteen (unless boats are barred) starts from the nearest water node within 50 units instead and
 *   looks half as far again for a visible crossing;
 * - from the start it walks the road graph at random (each node's links in a random rotation and direction, never
 *   back onto a node it has visited), at most 29 links and 230 units, until a link crosses the in-view circle at a
 *   point the camera sees, or the out-of-view circle at a point it does not, and climbs no more than half its length;
 * - the car's direction along the link is a coin toss; a car headed into a dead end (when switched-off roads are
 *   avoided) or off the wanted bearing fails the whole call.
 * Find2NodesForCarCreation's nearest nodes use the port's FindNodeClosestToCoors metric, |dx| + |dy| + 3|dz|: the iOS
 * search adds a fifth of the distance to the node's links, which is not ported. Its side effect on
 * CPopulation::m_bMoreCarsAndFewerPeds (a highway start) is not ported either. */

export interface CarCreationCache {
 /** Find2NodesForCarCreation's two nodes passing over switched-off ones, and its two over all of them. */
 avoiding:[PathNode|undefined,PathNode|undefined];all:[PathNode|undefined,PathNode|undefined];
 lastPosition:{x:number;y:number;z:number};nextRefreshMs:number;
}
/** The function's statics: no nodes yet, so the first call fills them (the executable's clock is past 0 by then). */
export const newCarCreationCache=():CarCreationCache=>({avoiding:[undefined,undefined],all:[undefined,undefined],lastPosition:{x:0,y:0,z:0},nextRefreshMs:-Infinity});

export interface CarCreationRequest {
 /** The centre, native. */
 position:{x:number;y:number;z:number};
 /** The bearing the spawn point must lie on from the centre: (dirX, dirY) · its unit direction against minDot,
  * above it when dotAbove, at or below it otherwise. */
 dirX:number;dirY:number;minDot:number;dotAbove:boolean;
 /** The circle whose crossing must be in view, and the one whose crossing must be out of it. */
 inViewDistance:number;outOfViewDistance:number;
 /** Switched-off roads are passed over and a car may not be headed into a dead end. */
 avoidSwitchedOff:boolean;
 /** No start from a water node. */
 noBoats:boolean;
}
export interface CarCreationWorld {
 nowMs:number;
 /** libc rand(): an integer from 0 to 0x7fffffff. */
 rand():number;
 /** CCamera::IsSphereVisible, native point. */
 sphereVisible(point:{x:number;y:number;z:number},radius:number):boolean;
}
export interface CarCreation {position:{x:number;y:number;z:number};node1:PathNode;node2:PathNode;t:number}

const nodeAt=(areas:ReadonlyMap<number,PathArea>,a:{area:number;node:number}|null|undefined)=>a?areas.get(a.area)?.nodes[a.node]:undefined;
/** The 2D distance between two native points. */
const d2=(ax:number,ay:number,b:readonly number[])=>Math.hypot(ax-b[0],ay-b[1]);

/** CPathFind::Find2NodesForCarCreation (iOS 0x1001bbeec): the nearest car node, and the first of the next three
 * nearest that is not linked to it. When none qualifies the second slot keeps what it held. */
export function find2NodesForCarCreation(areas:ReadonlyMap<number,PathArea>,p:{x:number;y:number;z:number},ignoreSwitchedOff:boolean,
 previous:[PathNode|undefined,PathNode|undefined]):[PathNode|undefined,PathNode|undefined]{
 const search={kind:'vehicle' as const,maxDistance:999999.875,ignoreDisabled:ignoreSwitchedOff,water:false};
 const first=findNthNodeClosestToCoors(areas,p,0,search);
 if(!first)return [undefined,undefined];
 const area=areas.get(first.address.area)!,linked=new Set<PathNode|undefined>();
 for(let i=0;i<first.linkCount;i++)linked.add(nodeAt(areas,area.links[first.baseLink+i]));
 let second=previous[1];
 for(let n=1;n<=3;n++){const next=findNthNodeClosestToCoors(areas,p,n,search);if(!next)break;if(!linked.has(next)){second=next;break;}}
 return [first,second];
}

/** CPathFind::ThisNodeWillLeadIntoADeadEnd (iOS 0x1001bcacc): following the only onward road (passing over the way
 * back and nodes of behaviour 1 to 10) reaches a node with none. */
export function thisNodeWillLeadIntoADeadEnd(areas:ReadonlyMap<number,PathArea>,node:PathNode,previous:PathNode){
 // The browser's guard against a loop of single roads, which the executable would follow for ever.
 for(let guard=0;guard<4096;guard++){
  if(node.linkCount===0)return true;
  const area=areas.get(node.address.area);let onward:PathNode|undefined;
  for(let i=0;i<node.linkCount;i++){
   const next=nodeAt(areas,area?.links[node.baseLink+i]);
   if(!next||next===previous||next.behaviour>=1&&next.behaviour<=10)continue;
   if(onward)return false;
   onward=next;
  }
  if(!onward)return true;
  previous=node;node=onward;
 }
 return false;
}

/** GenerateCarCreationCoors2. */
export function generateCarCreationCoors2(areas:ReadonlyMap<number,PathArea>,cache:CarCreationCache,request:CarCreationRequest,world:CarCreationWorld):CarCreation|undefined{
 const p=request.position,f=Math.fround;
 if(Math.hypot(p.x-cache.lastPosition.x,p.y-cache.lastPosition.y)>10||world.nowMs>cache.nextRefreshMs){
  cache.avoiding=find2NodesForCarCreation(areas,p,true,cache.avoiding);
  cache.all=find2NodesForCarCreation(areas,p,false,cache.all);
  cache.lastPosition={...p};cache.nextRefreshMs=world.nowMs+5000;
 }
 let inView=request.inViewDistance;
 let current:PathNode|undefined;
 if((world.rand()&15)===4&&!request.noBoats){
  current=findNthNodeClosestToCoors(areas,p,0,{kind:'vehicle',maxDistance:50,water:true});
  inView*=1.5;
 }else{
  const pair=request.avoidSwitchedOff?cache.avoiding:cache.all;
  current=(world.rand()&3)!==0?pair[0]:pair[1];
 }
 if(!current||!areas.has(current.address.area))return undefined;
 const visited:PathNode[]=[current];let walked=0;
 for(;;){
  const area=areas.get(current.address.area);if(!area)return undefined;
  // CCarCtrl::InitSequence and FindSequenceElement: the links in a random rotation, one way or the other.
  const n=current.linkCount,offset=n?world.rand()%n:world.rand(),otherWay=((world.rand()>>4)&1)!==0;
  if(n===0)return undefined;
  let next:PathNode|undefined;
  for(let i=0;i<n;i++){
   const k=otherWay?(offset+i)%n:(offset-i+n)%n,slot=current.baseLink+k;
   const candidate=nodeAt(areas,area.links[slot]),navi=area.navigationLinks[slot];
   if(!candidate||!navi||!areas.has(navi.area)||visited.includes(candidate))continue;
   next=candidate;break;
  }
  if(!next)return undefined;
  if(!request.avoidSwitchedOff||!next.switchedOff&&!current.switchedOff){
   const c=current.position,x=next.position,dC=f(d2(p.x,p.y,c)),dN=f(d2(p.x,p.y,x));
   const crossing=(radius:number,wantVisible:boolean)=>{
    let a=f(dC-radius),b=f(dN-radius);
    if(!(f(a*b)<0))return undefined;
    a=Math.abs(a);b=Math.abs(b);const s=f(a+b),inv=f(1/s);
    const at={x:f(inv*f(f(a*x[0])+f(b*c[0]))),y:f(inv*f(f(a*x[1])+f(b*c[1]))),z:f(inv*f(f(a*x[2])+f(b*c[2])))};
    return world.sphereVisible(at,5)===wantVisible?{at,t:f(a/s)}:undefined;
   };
   const hit=crossing(inView,true)??crossing(request.outOfViewDistance,false);
   if(hit&&Math.abs(c[2]-x[2])<=.5*d2(c[0],c[1],x)){
    let node1=current,node2=next,t=hit.t;
    if(!(world.rand()&8)){node1=next;node2=current;t=f(1-t);}
    if(node2.deadEnd&&thisNodeWillLeadIntoADeadEnd(areas,node2,node1)&&request.avoidSwitchedOff)return undefined;
    const dx=hit.at.x-p.x,dy=hit.at.y-p.y,d=Math.hypot(dx,dy),dot=dx/d*request.dirX+dy/d*request.dirY;
    if(request.dotAbove?!(dot>request.minDot):!(dot<=request.minDot))return undefined;
    return {position:hit.at,node1,node2,t};
   }
  }
  visited.push(next);
  if(visited.length>29)return undefined;
  walked+=d2(next.position[0],next.position[1],current.position);
  if(!(walked<230))return undefined;
  current=next;
 }
}
