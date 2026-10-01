/* CTaskComplexWalkRoundBuildingAttempt's route (TaskComplexWalkRoundBuildingAttempt.cpp, reversed: ComputeMoveDir
 * 0x654B80, ComputeCrapRoute 0x656F80, ComputeRoute 0x657BA0). A ped that walks into a building while seeking a
 * point or a ped gets a route of one or two points along the wall toward the side its target lies on (both sides
 * head on), each tried with growing reach, one attempt a frame; past twenty attempts, or when the first finds the
 * wall goes on, it takes the "crap" route: a random step back off the wall. Native axes (x east, y north, z up);
 * a ped's position is its origin, half a unit over which the lines are cast from its feet. */
export interface V3 {x:number;y:number;z:number}
/** CPointRoute's capacity. */
export const POINT_ROUTE_CAPACITY=8;
/** The attempts before the crap route is taken. */
export const WALK_ROUND_ATTEMPTS=20;
/** CWorld::GetIsLineOfSightClear over buildings alone, and ProcessLineOfSight's hit point (undefined when clear). */
export type BuildingHit=(from:V3,to:V3)=>V3|undefined;
const add=(a:V3,b:V3):V3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z}),sub=(a:V3,b:V3):V3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const scale=(a:V3,k:number):V3=>({x:a.x*k,y:a.y*k,z:a.z*k}),length=(a:V3)=>Math.hypot(a.x,a.y,a.z);
const rangeOf=(random:()=>number,lo:number,hi:number)=>lo+random()*(hi-lo);

export class WalkRoundBuildingRoute {
 /** m_nAttempts. */
 attempts=0;
 /** m_route and m_crapRoute, with whether each has had points put in it. */
 readonly route:V3[]=[];readonly crap:V3[]=[];
 routeHasPoints=false;crapHasPoints=false;
 /** m_normal, flattened and normalised by the constructor. */
 readonly normal:V3;
 constructor(readonly impactPos:V3,normal:V3,readonly headOn:boolean){
  const l=Math.hypot(normal.x,normal.y)||1;this.normal={x:normal.x/l,y:normal.y/l,z:0};
 }
 /** ComputeMoveDir: the target's offset from the impact, less its part along the wall's normal. */
 moveDir(target:V3):V3{
  const t={x:target.x-this.impactPos.x,y:target.y-this.impactPos.y},along=t.x*this.normal.x+t.y*this.normal.y;
  return {x:t.x-this.normal.x*along,y:t.y-this.normal.y*along,z:0};
 }
 /** ComputeCrapRoute: a point one to two units off the wall and up to one to either side, short of whatever it
  * hits by 0.35; nothing when that is under 0.35 away. */
 computeCrapRoute(origin:V3,hit:BuildingHit,random=Math.random){
  if(this.crap.length<POINT_ROUTE_CAPACITY){
   const feet={x:origin.x,y:origin.y,z:origin.z-.5},right={x:this.normal.y,y:-this.normal.x,z:0};
   const target=add(add(feet,scale(right,rangeOf(random,-1,1))),scale(this.normal,rangeOf(random,1,2)));
   const at=hit(feet,target);
   if(at){
    const dir=sub(at,feet),mag=length(dir);
    if(mag<.35)return;
    this.crap.push(sub(at,scale(dir,.35/mag)));
   }else this.crap.push(target);
  }
  this.crapHasPoints=true;
 }
 /** ComputeRoute: one attempt. Each side (the target's, then head on the other) is tried at the target's offset along
  * the wall times the attempt number (±0.2), 0.35 off the wall: a point that sees the target is the route; one from
  * which the wall's end can be rounded (two units back toward it is clear, from it and from 0.7 short of it) makes a
  * two-point route when that point sees the target, and the first such is kept as the crap route. A first attempt
  * that tries every side and returns nothing jumps to the crap route. */
 compute(origin:V3,target:V3,hit:BuildingHit,random=Math.random){
  this.attempts++;
  if(this.attempts+1>=WALK_ROUND_ATTEMPTS){
   if(!this.crapHasPoints)this.computeCrapRoute(origin,hit,random);
   this.route.length=0;this.route.push(...this.crap);this.routeHasPoints=true;
   return;
  }
  const clear=(a:V3,b:V3)=>!hit(a,b),normal2=scale(this.normal,2);
  let generated=0;
  for(let num=1;num>=-1;generated++,num-=this.headOn?2:3){
   let dir=this.moveDir(target);
   dir=scale(dir,rangeOf(random,-.2,.2)+this.attempts);
   dir=scale(dir,num);
   dir=add(dir,scale(this.normal,.35));
   const feet={x:origin.x,y:origin.y,z:origin.z-.5},point=add(feet,dir),l=length(dir)||1;
   const behind=sub(point,scale(dir,.7/l));
   if(!clear(feet,point))continue;
   if(clear(point,target)){if(this.route.length<POINT_ROUTE_CAPACITY)this.route.push(point);this.routeHasPoints=true;return;}
   const round=sub(point,normal2);
   if(!clear(point,round))continue;
   if(!clear(behind,sub(behind,normal2)))continue;
   if(!this.crapHasPoints){if(this.crap.length+2<=POINT_ROUTE_CAPACITY)this.crap.push(point,round);this.crapHasPoints=true;}
   if(clear(round,target)){if(this.route.length+2<=POINT_ROUTE_CAPACITY)this.route.push(point,round);this.routeHasPoints=true;}
  }
  if(this.attempts===1&&generated===(this.headOn?2:1))this.attempts=WALK_ROUND_ATTEMPTS;
 }
}

/** CEventBuildingCollision::AffectsPed's facing test and IsHeadOnCollision (both reversed), on the flattened normal
 * and the ped's forward: walking into it (the dot at most -0.5), and head on (beyond cos 30°). */
export function buildingCollisionFacing(normal:{x:number;y:number},forward:{x:number;y:number}){
 const l=Math.hypot(normal.x,normal.y)||1,dot=(normal.x*forward.x+normal.y*forward.y)/l;
 return {affects:dot<=-.5,headOn:-dot>.866};
}
