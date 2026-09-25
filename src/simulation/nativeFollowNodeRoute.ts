import type {PathArea,PathNode} from '../assets/pathNodes';

/* CTaskComplexFollowNodeRoute (TASK_FOLLOW_PATH_NODES_TO_COORD), the planning half: ComputePathNodes and ComputeRoute.
 * All points are the native Z-up ones the path files carry. */

/** CPedIntelligence::m_FollowNodeThresholdDistance: a target nearer than this, with a clear path, is walked straight at. */
export const FOLLOW_NODE_THRESHOLD_DISTANCE=30;
/** CNodeRoute and CPointRoute hold eight each. */
export const NODE_ROUTE_SIZE=8;
/** The task's constructor defaults, which the script's form takes: the target tolerance, the slow-down distance (the
 * last leg's move-state radius) and the height change past which a straight walk is not clear. */
export const FOLLOW_NODE_TARGET_TOLERANCE=.5,FOLLOW_NODE_SLOW_DOWN_DISTANCE=3,FOLLOW_NODE_HEIGHT_CHANGE=2;
/** CTaskSimpleGoToPoint's default radius, for the legs between nodes. */
export const FOLLOW_NODE_POINT_RADIUS=.5;

export interface NativePoint{x:number;y:number;z:number}
export interface NodeRouteWorld{
 areas:ReadonlyMap<number,PathArea>;
 /** CPedGeometryAnalyser::IsWanderPathClear(from, to, maxHeightChange, 4) == CLEAR. */
 clear(from:NativePoint,to:NativePoint,maxHeightChange:number):boolean;
}
export interface NodeRoutePlan{
 /** Where to walk, in order: the route's nodes, then the target when the route had room for it. */
 points:NativePoint[];
 /** CTaskComplexFollowNodeRoute::m_LastRoutePointIsTarget. Without it, the last node reached plans the next stretch. */
 lastIsTarget:boolean;
}
const at=(n:PathNode):NativePoint=>({x:n.position[0],y:n.position[1],z:n.position[2]});
const distance2D=(a:NativePoint,b:NativePoint)=>Math.hypot(a.x-b.x,a.y-b.y);
const pedNode=(n:PathNode|undefined):n is PathNode=>!!n&&n.kind==='pedestrian'&&!n.water;

/** ThePaths.FindNodeClosestToCoors(PATH_TYPE_PED) over the loaded areas. */
export function closestPedNode(areas:ReadonlyMap<number,PathArea>,point:NativePoint){
 let best:PathNode|undefined,d2=Number.POSITIVE_INFINITY;
 for(const area of areas.values())for(const n of area.nodes){
  if(!pedNode(n))continue;
  const e=(n.position[0]-point.x)**2+(n.position[1]-point.y)**2+(n.position[2]-point.z)**2;
  if(e<d2){d2=e;best=n;}
 }
 return best;
}

type Candidate={node:PathNode;distance:number;order:number};
const before=(a:Candidate,b:Candidate)=>a.distance<b.distance||a.distance===b.distance&&a.order<b.order;
const key=(n:PathNode)=>n.address.area*65536+n.address.node;
/** CPathFind::ComputeRoute(PATH_TYPE_PED) (unreversed): the shortest walk over the ped nodes from the one nearest the
 * ped to the one nearest the target, by the links' own lengths, and its first eight nodes. Nothing when the two lie in
 * different flood-fill groups or the search runs past its limit. */
export function computePedNodeRoute(areas:ReadonlyMap<number,PathArea>,from:NativePoint,to:NativePoint,maxVisited=20000):PathNode[]{
 const first=closestPedNode(areas,from),last=closestPedNode(areas,to);
 if(!first||!last||first.floodFill!==last.floodFill)return [];
 if(first===last)return [first];
 const heap:Candidate[]=[],distances=new Map<number,number>([[key(first),0]]),previous=new Map<number,PathNode>();
 let order=0,visited=0;
 const push=(node:PathNode,distance:number)=>{
  const item={node,distance,order:order++};let i=heap.length;heap.push(item);
  while(i){const parent=(i-1)>>1;if(!before(item,heap[parent]))break;heap[i]=heap[parent];i=parent;}heap[i]=item;
 };
 const pop=()=>{
  const result=heap[0],tail=heap.pop()!;
  if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&before(heap[child+1],heap[child]))child++;if(!before(heap[child],tail))break;heap[i]=heap[child];i=child;}heap[i]=tail;}
  return result;
 };
 push(first,0);
 while(heap.length){
  const current=pop();
  if(current.distance!==distances.get(key(current.node)))continue;
  if(++visited>maxVisited)return [];
  if(current.node===last){
   const route:PathNode[]=[];
   for(let n:PathNode|undefined=last;n;n=previous.get(key(n)))route.push(n);
   return route.reverse().slice(0,NODE_ROUTE_SIZE);
  }
  const node=current.node,area=areas.get(node.address.area);if(!area)continue;
  for(let slot=node.baseLink;slot<node.baseLink+node.linkCount;slot++){
   const ref=area.links[slot],target=ref&&areas.get(ref.area)?.nodes[ref.node];
   if(!pedNode(target)||target.floodFill!==first.floodFill)continue;
   // A link's length is a byte of whole units; a missing one is measured.
   const length=area.lengths[slot]??Math.hypot(target.position[0]-node.position[0],target.position[1]-node.position[1],target.position[2]-node.position[2]);
   const distance=current.distance+length,targetKey=key(target);
   if(distance>=(distances.get(targetKey)??Number.POSITIVE_INFINITY))continue;
   distances.set(targetKey,distance);previous.set(targetKey,node);push(target,distance);
  }
 }
 return [];
}

/** CTaskComplexFollowNodeRoute::CanGoStraightThere without bIgnoreHeightDifferenceFollowingNodes. */
function canGoStraightThere(world:NodeRouteWorld,from:NativePoint,to:NativePoint){
 return (from.x-to.x)**2+(from.y-to.y)**2+(from.z-to.z)**2<FOLLOW_NODE_THRESHOLD_DISTANCE**2&&world.clear(from,to,FOLLOW_NODE_HEIGHT_CHANGE);
}

/** ComputePathNodes then ComputeRoute, outside an interior, for a ped at `ped` (its origin) walking to `target` (already
 * put a unit above the ground under it). */
export function planFollowNodeRoute(world:NodeRouteWorld,ped:NativePoint,target:NativePoint):NodeRoutePlan{
 let nodes=canGoStraightThere(world,ped,target)?[]:computePedNodeRoute(world.areas,ped,target);
 // A route whose first node lies well past the target, as the ped sees it, is dropped for the straight walk: by 50
 // units when the heights differ by the threshold, by 3 otherwise.
 if(nodes.length){
  const slack=Math.abs(ped.z-target.z)>=FOLLOW_NODE_HEIGHT_CHANGE?50:3;
  if(distance2D(target,ped)+slack<distance2D(at(nodes[0]),ped))nodes=[];
 }
 // The route is cut at the first node from which the target can be walked straight at.
 for(let i=0;i<nodes.length;i++){
  const from=at(nodes[i]);from.z+=1;
  if(canGoStraightThere(world,from,target)){nodes=nodes.slice(0,i+1);break;}
 }
 const points=nodes.map(at),lastIsTarget=points.length<NODE_ROUTE_SIZE;
 if(lastIsTarget)points.push({...target});
 return {points,lastIsTarget};
}
