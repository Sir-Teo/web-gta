import type {PathArea,PathNode} from '../assets/pathNodes';
import {findNthNodeClosestToCoors} from './nativeScriptCarNodes';

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
const PED_SEARCH={kind:'pedestrian' as const,maxDistance:999999.875,water:false};

/** ThePaths.FindNodeClosestToCoors(PATH_TYPE_PED) over the loaded areas: land nodes by the iOS weighted score
 * (findNthNodeClosestToCoors), switched-off ones included. */
export function closestPedNode(areas:ReadonlyMap<number,PathArea>,point:NativePoint){return findNthNodeClosestToCoors(areas,point,0,PED_SEARCH);}

/** CPathFind's idle m_totalDistFromOrigin: int16 distances, so a node that would reach this is never entered. */
const UNREACHED=0x7ffe;
/** aNodesToBeCleared holds 5000; DoPathSearch gives up once 4950 have been touched. */
const SEARCH_TOUCH_LIMIT=4950;
/** CPathFind::ComputeRoute(PATH_TYPE_PED) through DoPathSearch, as the iOS executable runs them (0x1001b9bc4,
 * 0x1001b9cd4): the ends are the nodes FindNodeClosestToCoors gives for the target and the ped (land nodes, switched-off
 * ones allowed), in the same flood-fill group. Dial's Dijkstra over the links' byte lengths grows out from the target,
 * blocked only at water–land links and unloaded areas, and the route is read back from the ped's node, at each node
 * taking the first link in link order whose node lies exactly that link's length nearer the target: the ped's node and
 * up to seven more. Nothing when both ends are one node, when more than 4950 nodes are touched, or when the search runs
 * dry as it reaches the ped's node (that node the farthest from the target in its graph). */
export function computePedNodeRoute(areas:ReadonlyMap<number,PathArea>,from:NativePoint,to:NativePoint):PathNode[]{
 const target=closestPedNode(areas,to);if(!target)return [];
 const origin=closestPedNode(areas,from);if(!origin)return [];
 if(origin===target||origin.floodFill!==target.floodFill)return [];
 const distance=new Map<PathNode,number>([[target,0]]),buckets:PathNode[][]=[[target]];
 let open=1,touched=1,finished=false,depth=0;
 const links=function*(node:PathNode){
  const area=areas.get(node.address.area);if(!area)return;
  for(let slot=node.baseLink;slot<node.baseLink+node.linkCount;slot++){
   const ref=area.links[slot],next=ref&&areas.get(ref.area)?.nodes[ref.node];if(!next)continue;
   // A link's length is a byte of whole units; a missing one is measured.
   yield {next,length:area.lengths[slot]??Math.round(Math.hypot(next.position[0]-node.position[0],next.position[1]-node.position[1],next.position[2]-node.position[2]))};
  }
 };
 for(;;){
  const bucket=buckets[depth]??[];
  for(let i=0;i<bucket.length;i++){
   const node=bucket[i];if(distance.get(node)!==depth)continue;
   for(const {next,length} of links(node)){
    if(next.kind!=='pedestrian'||next.water!==node.water)continue;
    const d=depth+length,known=distance.get(next)??UNREACHED;
    if(d>=known)continue;
    if(known===UNREACHED)touched++;else open--;
    distance.set(next,d);(buckets[d]??=[]).push(next);open++;
   }
   if(node===origin)finished=true;
   open--;
  }
  if(open<=0)return [];
  depth++;
  if(!(touched<SEARCH_TOUCH_LIMIT))return [];
  if(finished)break;
 }
 const route=[origin];
 for(let node=origin;node!==target&&route.length<NODE_ROUTE_SIZE;){
  const here=distance.get(node)!;let step:PathNode|undefined;
  for(const {next,length} of links(node))if(here-length===(distance.get(next)??UNREACHED)){step=next;break;}
  if(!step)break;
  route.push(step);node=step;
 }
 return route;
}

/** CTaskComplexFollowNodeRoute::CanGoStraightThere without bIgnoreHeightDifferenceFollowingNodes: within the threshold
 * in 3D (equal counts), and a clear wander path. */
function canGoStraightThere(world:NodeRouteWorld,from:NativePoint,to:NativePoint){
 return (from.x-to.x)**2+(from.y-to.y)**2+(from.z-to.z)**2<=FOLLOW_NODE_THRESHOLD_DISTANCE**2&&world.clear(from,to,FOLLOW_NODE_HEIGHT_CHANGE);
}

export interface NodeRouteOptions{
 /** m_bKeepNodesHeadingAwayFromTarget: set by TASK_FOLLOW_PATH_NODES_TO_COORD (and _WITH_RADIUS), which never drop a
  * route; clear for CTaskComplexSeekEntity. */
 keepNodesHeadingAway?:boolean;
 /** m_CurrNode: the node the ped was walking to, which a new route resumes at when it holds it. */
 currentNode?:PathNode;
}
/** ComputePathNodes then ComputeRoute (iOS 0x1004061c4, 0x100406814), outside an interior, for a ped at `ped` (its
 * origin) walking to `target` (already put a unit above the ground under it). `nodes` are the route's nodes, the start
 * of `points`, and `resumeAt` is m_CurrPtIdx. */
export function planFollowNodeRoute(world:NodeRouteWorld,ped:NativePoint,target:NativePoint,options:NodeRouteOptions={}):NodeRoutePlan&{nodes:PathNode[];resumeAt:number}{
 let nodes=canGoStraightThere(world,ped,target)?[]:computePedNodeRoute(world.areas,ped,target);
 // Unless the task keeps them, a route whose first node lies farther from the target than the ped does, by 3 (50 when
 // the heights differ by the threshold), is dropped for the straight walk.
 if(nodes.length&&!options.keepNodesHeadingAway){
  const slack=Math.abs(ped.z-target.z)>=FOLLOW_NODE_HEIGHT_CHANGE?50:3;
  if(distance2D(target,at(nodes[0]))>distance2D(target,ped)+slack)nodes=[];
 }
 // The route is cut at the first node (raised a unit) from which the target can be walked straight at.
 for(let i=0;i<nodes.length;i++){
  const from=at(nodes[i]);from.z+=1;
  if(canGoStraightThere(world,from,target)){nodes=nodes.slice(0,i+1);break;}
 }
 const points=nodes.map(at),lastIsTarget=points.length<NODE_ROUTE_SIZE;
 if(lastIsTarget)points.push({...target});
 const resume=options.currentNode?nodes.indexOf(options.currentNode):-1;
 return {points,lastIsTarget,nodes,resumeAt:resume<0?0:resume};
}
/** The script's time for TASK_FOLLOW_PATH_NODES_TO_COORD (and _WITH_RADIUS) and TASK_GOTO_CHAR, in seconds: -1 is
 * 50000 ms (iOS 0x100595d74), after which the ped is put on the target; -2, or any other negative, is no limit. */
export function followRouteSeconds(milliseconds:number){return milliseconds===-1?50:milliseconds<0?Number.POSITIVE_INFINITY:milliseconds/1000;}
