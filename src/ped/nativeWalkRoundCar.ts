/* CTaskComplexWalkRoundCar for a ped walking to a point with a car in the way. CTaskSimpleGoToPoint hands the ped this
 * task on EVENT_POTENTIAL_WALK_INTO_VEHICLE. Its route (ComputeRouteRoundSmallCar / BigCar, over
 * CPedGeometryAnalyser::ComputeRouteRoundEntityBoundingBox) is unreversed. What is kept here is what those names say:
 * the ped keeps to the car's bounding box, padded by its own radius, and goes round it by the box's corners on the
 * shorter side. Plane points are renderer x and z. */

export interface V2{x:number;z:number}
/** A car's footprint: its box centre, its unit forward along the plane, and its half length and half width. */
export interface CarFootprint{center:V2;forward:V2;halfLength:number;halfWidth:number}

/** CPedGeometryAnalyser's ped radius about a box, plus room for the wheels and mirrors past the bounding box's sides. */
export const WALK_ROUND_PAD=.35+.4;

const local=(box:CarFootprint,p:V2)=>{
 const dx=p.x-box.center.x,dz=p.z-box.center.z;
 // u along the car's forward, v across it (its right is the forward turned a quarter clockwise in the plane).
 return {u:dx*box.forward.x+dz*box.forward.z,v:dx*-box.forward.z+dz*box.forward.x};
};
const world=(box:CarFootprint,u:number,v:number):V2=>({x:box.center.x+box.forward.x*u-box.forward.z*v,z:box.center.z+box.forward.z*u+box.forward.x*v});

/** Whether the segment a-b passes through the box's inside (half extents L and W, in the box's own axes). */
function segmentCrosses(a:{u:number;v:number},b:{u:number;v:number},L:number,W:number){
 let t0=0,t1=1;
 const du=b.u-a.u,dv=b.v-a.v;
 for(const [p,d,h] of [[a.u,du,L],[a.v,dv,W]] as const){
  if(Math.abs(d)<1e-9){if(p<=-h||p>=h)return false;continue;}
  let ta=(-h-p)/d,tb=(h-p)/d;if(ta>tb)[ta,tb]=[tb,ta];
  t0=Math.max(t0,ta);t1=Math.min(t1,tb);if(t0>=t1)return false;
 }
 return true;
}

/** How far inside the padded box still counts as on its edge, so a ped that has just reached a corner, or stands on a
 * side, routes along the box rather than stepping out of it again. */
const EDGE=.1;
/** Where to walk now to get from `from` to `to` without walking into the car: nothing while the straight way is clear,
 * otherwise the next corner of the shortest way round the padded box. That way runs corner to corner along the box,
 * and its first leg must be clear of the world's fixed geometry (`blocked`). A ped inside the padded box (set down at a
 * door) steps straight out of it first, across its nearer long side or end: walking on along the body snags the ped
 * on it. */
export function walkRoundCar(from:V2,to:V2,box:CarFootprint,pad=WALK_ROUND_PAD,blocked?:(from:V2,to:V2)=>boolean):V2|undefined{
 const L=box.halfLength+pad,W=box.halfWidth+pad,a=local(box,from),b=local(box,to);
 // A goal inside the padded box (a door beside the car) is walked straight at once the ped is clear of the car itself.
 const goalInside=Math.abs(b.u)<L&&Math.abs(b.v)<W;
 if(Math.abs(a.u)<L-EDGE&&Math.abs(a.v)<W-EDGE){
  if(goalInside)return undefined;
  const outU=L-Math.abs(a.u),outV=W-Math.abs(a.v);
  return outV<=outU?world(box,a.u,Math.sign(a.v||1)*(W+.05)):world(box,Math.sign(a.u||1)*(L+.05),a.v);
 }
 // The car without the pad, for a goal inside the pad; the padded box, a little shrunk so its own edges are clear,
 // otherwise.
 const [cl,cw]=goalInside?[box.halfLength,box.halfWidth]:[L-EDGE,W-EDGE];
 if(!segmentCrosses(a,b,cl,cw))return undefined;
 // Dijkstra over the start, the four corners and the goal.
 const corners=[{u:L,v:W},{u:L,v:-W},{u:-L,v:-W},{u:-L,v:W}];
 const nodes=[a,...corners,b],n=nodes.length,goal=n-1;
 const clear=(i:number,j:number)=>!segmentCrosses(nodes[i],nodes[j],cl,cw)&&(i!==0||!blocked?.(from,world(box,nodes[j].u,nodes[j].v)));
 const dist=new Array<number>(n).fill(Infinity),prev=new Array<number>(n).fill(-1),done=new Array<boolean>(n).fill(false);
 dist[0]=0;
 for(;;){
  let i=-1;for(let k=0;k<n;k++)if(!done[k]&&dist[k]<Infinity&&(i<0||dist[k]<dist[i]))i=k;
  if(i<0||i===goal)break;
  done[i]=true;
  for(let j=1;j<n;j++){
   if(done[j]||!clear(i,j))continue;
   const d=dist[i]+Math.hypot(nodes[j].u-nodes[i].u,nodes[j].v-nodes[i].v);
   if(d<dist[j]){dist[j]=d;prev[j]=i;}
  }
 }
 if(prev[goal]<0)return undefined;
 // The first hop; a corner the ped is already at hands on to the one after it.
 const hops:number[]=[];for(let k=goal;k>0;k=prev[k])hops.unshift(k);
 let hop=hops[0];
 if(hop!==goal&&Math.hypot(nodes[hop].u-a.u,nodes[hop].v-a.v)<.3&&hops.length>1)hop=hops[1];
 return hop===goal?undefined:world(box,nodes[hop].u,nodes[hop].v);
}
