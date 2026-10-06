import type {PathArea,PathNode} from '../assets/pathNodes';
/* The car path questions the script asks, over the loaded areas (native coordinates):
 * - CPathFind::FindNodeClosestToCoors (SA's unreversed; the iOS executable's, 0x1001ba348): the node with the least
 *   0.3 × (|dx| + |dy| + 3|dz|) + 0.2 × its distance to the nearest of its links (see nodeScore).
 * - FindNthNodeClosestToCoors (iOS 0x1001bbce8): the same N more times, each time passing over the nodes already
 *   picked.
 * - FindNodeCoorsForScript (gta-reversed 0x4505E0): a node of some width gives a point beside it, across from its
 *   first link, so a car set down there is not on the divider.
 * - FindNodeOrientationForCarPlacement (reVC's): the heading of the node's first link.
 * - FindNodeCoorsForScript for two nodes (0x450780): a point beside the first, headed for the second. */

/** The loaded node a link slot names. */
function linked(areas:ReadonlyMap<number,PathArea>,node:PathNode,slot=0){
 const address=areas.get(node.address.area)?.links[node.baseLink+slot];
 return address?areas.get(address.area)?.nodes[address.node]:undefined;
}

export interface NodeSearch {
 /** PATH_TYPE_VEH or PATH_TYPE_PED. */
 kind:'vehicle'|'pedestrian';
 /** Only a node scoring under this is found. */
 maxDistance:number;
 /** Nodes switched off (SWITCH_ROADS_OFF and the like) are passed over. */
 ignoreDisabled?:boolean;
 /** Boat nodes only, or land nodes only. */
 water?:boolean;
}

/** CCollision::DistToLineSqr (iOS 0x10017fdec): the squared distance from `p` to the segment from `a` to `b`. */
export function distToLineSqr(a:readonly number[],b:readonly number[],p:{x:number;y:number;z:number}){
 const vx=b[0]-a[0],vy=b[1]-a[1],vz=b[2]-a[2],wx=p.x-a[0],wy=p.y-a[1],wz=p.z-a[2],dot=vx*wx+vy*wy+vz*wz,ww=wx*wx+wy*wy+wz*wz;
 if(dot<=0)return ww;
 const vv=vx*vx+vy*vy+vz*vz;
 if(dot>=vv)return (p.x-b[0])**2+(p.y-b[1])**2+(p.z-b[2])**2;
 const r=ww-dot*dot/vv;return r<=0?0:r;
}
/** FindNodeClosestToCoors' score of a node (iOS 0x1001bba4c and 0x1001bb90c): 0.3 × (|dx| + |dy| + 3|dz|), and, only
 * when that alone beats `best`, 0.2 × the distance to the nearest of the node's links (the segments to its loaded
 * linked nodes; 999999.875 squared for none, so a node with no links scores about 200 more). */
export function nodeScore(areas:ReadonlyMap<number,PathArea>,node:PathNode,point:{x:number;y:number;z:number},best:number){
 const f=Math.fround,[x,y,z]=node.position;
 const d=f(f(f(Math.abs(x-point.x)+Math.abs(y-point.y))+f(Math.abs(z-point.z)*3))*.3);
 if(!(d<best))return d;
 let nearest=999999.875;
 for(let i=0;i<node.linkCount;i++){const to=linked(areas,node,i);if(to)nearest=Math.min(nearest,distToLineSqr(node.position,to.position,point));}
 return f(d+f(.2*Math.sqrt(nearest)));
}
/** FindNthNodeClosestToCoors: the nth (0 the nearest) node of the kind, the score under `maxDistance`. Nothing when
 * fewer than n + 1 qualify. Ties keep the first found (the executable looks in the point's own area first, then in
 * rings of areas round it; here the loaded areas in their order). */
export function findNthNodeClosestToCoors(areas:ReadonlyMap<number,PathArea>,point:{x:number;y:number;z:number},nth:number,search:NodeSearch){
 const picked=new Set<PathNode>();
 for(let n=0;;n++){
  let best:PathNode|undefined,bestScore=search.maxDistance;
  for(const area of areas.values())for(const node of area.nodes){
   if(node.kind!==search.kind||picked.has(node)||node.water!==!!search.water||search.ignoreDisabled&&node.switchedOff)continue;
   const score=nodeScore(areas,node,point,bestScore);
   if(score<bestScore){bestScore=score;best=node;}
  }
  if(!best)return undefined;
  if(n>=nth)return best;
  picked.add(best);
 }
}

/** FindNodeCoorsForScript: the node itself, or, for a node with width and links, the point width + 2.7 to the left of
 * the way to its first link, that way turned to face east. */
export function findNodeCoorsForScript(areas:ReadonlyMap<number,PathArea>,node:PathNode){
 const [x,y,z]=node.position;
 const next=node.width&&node.linkCount?linked(areas,node):undefined;
 if(!next)return {x,y,z};
 let dx=next.position[0]-x,dy=next.position[1]-y;const length=Math.hypot(dx,dy);
 if(!length)return {x,y,z};
 dx/=length;dy/=length;
 if(dx<0){dx=-dx;dy=-dy;}
 const offset=node.width+2.7;
 // CVector2D::GetPerpLeft: (-y, x).
 return {x:x-dy*offset,y:y+dx*offset,z};
}

/** FindNodeOrientationForCarPlacement: the heading in degrees (CVector2D::Heading, atan2(-x, y)) of the way to the
 * node's first link, or 0 for a node with none. */
export function findNodeOrientationForCarPlacement(areas:ReadonlyMap<number,PathArea>,node:PathNode){
 const next=node.linkCount?linked(areas,node):undefined;
 if(!next)return 0;
 const dx=next.position[0]-node.position[0],dy=next.position[1]-node.position[1];
 if(!dx&&!dy)return 0;
 return Math.atan2(-dx,dy)*180/Math.PI;
}

/** FindNodeCoorsForScript(a, b): the heading in degrees of the way from a to b, and the point width + 2.7 to the left of
 * that way beside a, or a itself for a node of no width. */
export function findNodeCoorsForScriptBetween(a:PathNode,b:PathNode){
 let dx=b.position[0]-a.position[0],dy=b.position[1]-a.position[1];const length=Math.hypot(dx,dy);
 if(length){dx/=length;dy/=length;}
 const heading=Math.atan2(-dx,dy)*180/Math.PI,[x,y,z]=a.position;
 if(!a.width)return {x,y,z,heading};
 const offset=a.width+2.7;
 return {x:x-dy*offset,y:y+dx*offset,z,heading};
}

/** CPathFind::FindNodePairClosestToCoors (PC 0x44FEE0, unreversed; iOS 0x1001bc604), as GET_CLOSEST_STRAIGHT_ROAD
 * asks it (car nodes, switched-off ones passed over, land only). Over the areas in order, the node with the least
 * |dx| + |dy| + 3|dz| (the search starts at 10000) that has a link to a node passing the same tests, longer than
 * `minDist` in 3D; of that node's links, the last such. Nothing unless the measure is under `maxDist`, which is the
 * reach of the search, not a bound on the link. The heading is the way from the second node to the first across the
 * ground, in degrees, unwrapped (atan2(-dx, dy)). */
export function findNodePairClosestToCoors(areas:ReadonlyMap<number,PathArea>,point:{x:number;y:number;z:number},minDist:number,maxDist:number){
 const f=Math.fround,ok=(n:PathNode)=>n.kind==='vehicle'&&!n.switchedOff&&!n.water;
 let best=10000,first:PathNode|undefined,second:PathNode|undefined;
 for(const key of [...areas.keys()].sort((a,b)=>a-b))for(const node of areas.get(key)!.nodes){
  if(!ok(node))continue;
  const [x,y,z]=node.position,d=f(f(f(Math.abs(x-point.x))+f(Math.abs(y-point.y)))+f(Math.abs(z-point.z)*3));
  if(!(d<best)||node.linkCount===0)continue;
  for(let slot=0;slot<node.linkCount;slot++){
   const other=linked(areas,node,slot);if(!other||!ok(other))continue;
   if(!(f(Math.hypot(x-other.position[0],y-other.position[1],z-other.position[2]))>minDist))continue;
   best=d;first=node;second=other;
  }
 }
 if(!first||!second||!(best<maxDist))return undefined;
 const dx=first.position[0]-second.position[0],dy=first.position[1]-second.position[1];
 return {first,second,heading:f(f(Math.atan2(-dx,dy)*180)/f(Math.PI))};
}
/** GET_CLOSEST_STRAIGHT_ROAD (iOS 0x1001e357c): the pair's FindNodeCoorsForScript points and the heading, and the
 * condition set when one was found; zeros and false when not. */
export function findClosestStraightRoad(areas:ReadonlyMap<number,PathArea>,point:{x:number;y:number;z:number},minDist:number,maxDist:number){
 const pair=findNodePairClosestToCoors(areas,point,minDist,maxDist);
 if(!pair)return undefined;
 const a=findNodeCoorsForScript(areas,pair.first),b=findNodeCoorsForScript(areas,pair.second);
 return {node1X:a.x,node1Y:a.y,node1Z:a.z,node2X:b.x,node2Y:b.y,node2Z:b.z,angle:pair.heading};
}

