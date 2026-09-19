/* The heat-seeking rocket's target, pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166:
 * - CWeapon::EvaluateTargetForHeatSeekingMissile (0x73E560) rates a vehicle by distance and by how far it lies off the
 *   aim line, and rejects it when the off-line distance times the tolerance reaches its distance.
 * - CWeapon::PickTargetForHeatSeekingMissile (0x73F910) takes the lowest rating among living, targetable vehicles,
 *   rated from five units along the aim.
 * - CCam::Process_Rocket for the heat seeker marks that target, re-tests the line of sight to it once a second, and
 *   restarts the lock timer whenever the target changes or is out of sight. The crosshair turns red 1.5 s in.
 * - CWeapon::FireProjectile picks again from the ped's position and forward while a target is marked, and fires a
 *   plain rocket when it finds none.
 * Any consistent units; `now` is in milliseconds. */

type V3={x:number;y:number;z:number};
export interface HeatSeekCandidate<K>{key:K;position:V3;health:number;aircraft?:boolean;targetable?:boolean}

/** CCollision::DistToLine: the distance from `point` to the segment from `a` to `b`. */
export function distToLine(a:V3,b:V3,point:V3){
 const ab={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},ap={x:point.x-a.x,y:point.y-a.y,z:point.z-a.z};
 const dot=ab.x*ap.x+ab.y*ap.y+ab.z*ap.z;
 if(dot<=0)return Math.hypot(ap.x,ap.y,ap.z);
 const len2=ab.x*ab.x+ab.y*ab.y+ab.z*ab.z;
 if(dot>=len2)return Math.hypot(point.x-b.x,point.y-b.y,point.z-b.z);
 const t=dot/len2;return Math.hypot(ap.x-ab.x*t,ap.y-ab.y*t,ap.z-ab.z*t);
}
/** EvaluateTargetForHeatSeekingMissile: lower is better; -1 rejects the target. */
export function evaluateHeatSeekTarget(target:V3,origin:V3,direction:V3,tolerance:number,o:{aircraft?:boolean;planesPriority?:boolean;preferred?:boolean}={}){
 const dist=Math.hypot(origin.x-target.x,origin.y-target.y,origin.z-target.z);
 const offLine=distToLine(origin,{x:origin.x+direction.x*250,y:origin.y+direction.y*250,z:origin.z+direction.z*250},target);
 if(offLine*tolerance>=dist)return -1;
 let rating=Math.sqrt(dist)/10+offLine/dist;
 if(o.planesPriority&&o.aircraft)rating*=.25;
 if(o.preferred)rating*=.25;
 return rating;
}
/** PickTargetForHeatSeekingMissile: the best-rated vehicle; a later equal rating wins. */
export function pickHeatSeekTarget<K>(candidates:Iterable<HeatSeekCandidate<K>>,origin:V3,direction:V3,tolerance:number,o:{ignore?:K;planesPriority?:boolean;preferred?:K}={}){
 const point={x:origin.x+direction.x*5,y:origin.y+direction.y*5,z:origin.z+direction.z*5};
 let best:K|undefined,min=Infinity;
 for(const c of candidates){
  if(c.key===o.ignore||c.targetable===false||c.health<=0)continue;
  const rating=evaluateHeatSeekTarget(c.position,point,direction,tolerance,{aircraft:c.aircraft,planesPriority:o.planesPriority,preferred:o.preferred!==undefined&&c.key===o.preferred});
  if(rating>=0&&rating<=min){min=rating;best=c.key;}
 }
 return best;
}
/** The player's heat-seeker lock (CPlayerPedData's m_nFireHSMissilePressedTime, m_LastHSMissileTarget,
 * m_nLastHSMissileLOSTime and m_bLastHSMissileLOS), advanced by CCam::Process_Rocket each frame in the heat-seeker
 * camera. */
export class HeatSeekLock<K>{
 pressedTime=0;lastTarget?:K;lastLosTime=0;lastLos=false;
 /** The target CWeaponEffects::MarkTarget marks this frame, if any. */
 marked?:K;
 /** CTaskSimplePlayerOnFoot entering MODE_ROCKETLAUNCHER_HS: the press time starts and the last target clears. */
 enter(now:number){this.pressedTime=now;this.lastTarget=undefined;this.marked=undefined;}
 /** One camera frame: `pick` is PickTargetForHeatSeekingMissile from the camera, `lineOfSight` the world test. */
 update(now:number,pick:(preferred:K|undefined)=>K|undefined,lineOfSight:(target:K)=>boolean){
  if(!this.pressedTime)this.pressedTime=now;
  const target=pick(this.lastTarget);
  if(target!==undefined&&now-this.lastLosTime>1000){this.lastLosTime=now;this.lastLos=lineOfSight(target);}
  if(!this.lastLos||target===undefined||target!==this.lastTarget)this.pressedTime=now;
  this.marked=target;this.lastTarget=target;
 }
 /** The crosshair's red lock: more than 1.5 s since the press time last restarted. */
 locked(now:number){return this.marked!==undefined&&now-this.pressedTime>1500;}
 /** Out of the heat-seeker camera nothing is marked. */
 leave(){this.marked=undefined;}
}
