import type {PathArea,PathNode} from '../assets/pathNodes';
/* The car path questions the script asks, over the loaded areas (native coordinates):
 * - CPathFind::FindNodeClosestToCoors (SA's unreversed, reVC's): the node with the least |dx| + |dy| + 3|dz|.
 * - FindNthNodeClosestToCoors: the same N more times, each time passing over the nodes already picked.
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
 /** Only a node nearer than this is found. */
 maxDistance:number;
 /** Nodes switched off (SWITCH_ROADS_OFF and the like) are passed over. */
 ignoreDisabled?:boolean;
 /** Boat nodes only, or land nodes only. */
 water?:boolean;
}

/** FindNthNodeClosestToCoors: the nth (0 the nearest) node of the kind. Nothing when fewer than n + 1 qualify. */
export function findNthNodeClosestToCoors(areas:ReadonlyMap<number,PathArea>,point:{x:number;y:number;z:number},nth:number,search:NodeSearch){
 const picked=new Set<PathNode>();
 for(let n=0;;n++){
  let best:PathNode|undefined,bestDistance=Infinity;
  for(const area of areas.values())for(const node of area.nodes){
   if(node.kind!==search.kind||picked.has(node)||node.water!==!!search.water||search.ignoreDisabled&&node.switchedOff)continue;
   const d=Math.abs(node.position[0]-point.x)+Math.abs(node.position[1]-point.y)+3*Math.abs(node.position[2]-point.z);
   if(d<bestDistance){bestDistance=d;best=node;}
  }
  if(!best||!(bestDistance<search.maxDistance))return undefined;
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
