/* A wandering ped's route through the ped path network, pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166
 * (TaskComplexWander.cpp).
 * - The wander keeps a direction in eighths of a turn; GetWanderTaskByPedType starts it at random (0 to 7).
 * - CTaskComplexWander::UpdateDir (0x669DA0, reversed): at a node with three or more links, a ped wandering
 *   sensibly draws (3 x frame counter + its random seed) % 100. From 81 to 90 it turns a quarter one way (+2), above
 *   90 a quarter the other (+6). It keeps the new direction only when the link it then takes lies within three
 *   eighths of the old direction, compared without wrapping round, as the source does.
 * - CPathFind::FindNextNodeWandering (0x451B70) and CreateNextSubTask are retail stubs. Here the next node is the link
 *   heading closest to the direction, not back to the node the ped came from unless nothing else links on, and a
 *   straight-on step takes that link's direction (CreateNextSubTask stores FindNextNodeWandering's out direction). */

export interface WanderLink<T>{node:T;x:number;y:number;back:boolean}

/** The unit vector of direction `dir` (eighths of a turn, 0 along +y, turning toward +x). */
export function wanderDirVector(dir:number){const a=dir*Math.PI/4;return {x:Math.sin(a),y:Math.cos(a)};}
/** The nearest eighth of a turn for a vector. */
export function wanderSector(x:number,y:number){return ((Math.round(Math.atan2(x,y)/(Math.PI/4))%8)+8)%8;}
/** CTaskComplexWander::UpdateDir's draw at a node with `links` links. */
export function wanderUpdateDir(dir:number,links:number,frame:number,seed:number){
 if(links<3)return dir;
 const r=(3*frame+seed)%100;
 return r<=90?r>80?(dir+10)%8:dir:(dir+6)%8;
}
/** The link heading closest to `dir`, not back where the ped came from while another link leads on. */
export function findNextNodeWandering<T>(links:readonly WanderLink<T>[],dir:number){
 const v=wanderDirVector(dir),ahead=links.filter(l=>!l.back),pool=ahead.length?ahead:links;
 let best:WanderLink<T>|undefined,bestDot=-Infinity;
 for(const l of pool){const len=Math.hypot(l.x,l.y)||1,dot=(l.x*v.x+l.y*v.y)/len;if(dot>bestDot){bestDot=dot;best=l;}}
 return best&&{node:best.node,dir:wanderSector(best.x,best.y)};
}
/** One node reached: the next node and the wander's new direction. `links` counts every link of the reached node. */
export function wanderStep<T>(dir:number,links:number,frame:number,seed:number,candidates:readonly WanderLink<T>[]){
 const turned=wanderUpdateDir(dir,links,frame,seed),next=findNextNodeWandering(candidates,turned);
 if(!next)return undefined;
 if(turned===dir)return {node:next.node,dir:next.dir};
 const high=Math.max(next.dir,dir),low=Math.min(next.dir,dir);
 return {node:next.node,dir:(high-low+8)%8<=3?turned:dir};
}
