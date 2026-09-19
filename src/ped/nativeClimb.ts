/* CTaskSimpleClimb (TaskSimpleClimb.cpp, fully reversed) and the climb entry points of the jump tasks.
 *
 * - ScanToGrab (0x67FD30) / ScanToGrabSectorList (0x67DE10): the climb, stand-up, vault and find-edge sphere models
 *   (TaskSimpleClimb_models.h, CreateColModel 0x67A890) against buildings, static objects and, for the stand-up and
 *   vault tests, vehicles. Only CCollision::ProcessColModels' first col point matters: the lowest-index model sphere
 *   that touches the entity, at the entity's closest point, with the normal pointing from that point to the sphere.
 * - TestForClimb (0x6803A0), TestForStandUp (0x680570), TestForVault (0x6804D0), StartAnim (0x67DBE0), ProcessPed
 *   (0x680DC0), MakeAbortable (0x67A280), GetCameraTargetPos (0x67A390).
 * - The climb animations (ped.ifp CLIMB_*) are partial, carry no velocity extraction and blend through
 *   CAnimManager::BlendAnimation (0x4D4610) and CAnimBlendAssociation::UpdateBlend / UpdateTime (0x4D13D0).
 *
 * Vectors are native (z up); speeds are units per 1/50 s. The ped position is the collision centre, one unit above the
 * feet. Approximations, recorded in docs/FIDELITY_AUDIT.md:
 * - CStats::GetFatAndMuscleModifier is a retail stub: STAT_MOD_0 (climb reach) is 0 and STAT_MOD_1 (climb animation
 *   speed) is 1, the values for an unmodified body.
 * - ProcessPed eases toward the next hold by a quarter of the gap per frame; the browser steps at 60 Hz, so the quarter
 *   is applied at the PC frame limiter's 30 fps rate.
 * - Entities are scanned in the collision query's order rather than the sector lists' order. Physical climb entities
 *   (moving objects, boats while swimming, stopped trains) are not grabbed. */

export type V3={x:number;y:number;z:number};
/** eClimbHeights. */
export const CLIMB={NOT_READY:0,GRAB:1,PULLUP:2,STANDUP:3,FINISHED:4,VAULT:5,FINISHED_V:6} as const;
export type ClimbHeight=typeof CLIMB[keyof typeof CLIMB];
export const CLIMB_CLIPS=['CLIMB_jump','CLIMB_idle','CLIMB_Pull','CLIMB_Stand','CLIMB_Stand_finish','CLIMB_jump_B','CLIMB_jump2fall'] as const;
export type ClimbClip=typeof CLIMB_CLIPS[number];
/** Model-space sphere: x is always 0 and the piece is the sphere's index. */
export interface ClimbModelSphere{y:number;z:number;r:number}
const spheres=(r:number,points:readonly (readonly [number,number])[])=>points.map(([y,z])=>({y,z,r}));
export const CLIMB_SPHERES:readonly ClimbModelSphere[]=spheres(.4,[[-.06,1.2],[-.06,1.7],[-.06,2.2],[-.06,2.5],
 [.5,2.9],[.5,2.4],[.5,1.9],[.5,1.4],[.5,.9],[.5,.4],[1,2.9],[1,2.4],[1,1.9],[1,1.4],[1,.9],[1,.4],
 [1.5,2.9],[1.5,2.4],[1.5,1.9],[1.5,1.4],[1.5,.9],[1.5,.4]]);
export const STAND_UP_SPHERES:readonly ClimbModelSphere[]=spheres(.35,[[.6,1.75],[.6,1.3],[.6,.85],[.3,.65],[0,.5],[0,.1],[0,-.3]]);
export const VAULT_SPHERES:readonly ClimbModelSphere[]=spheres(.3,[[1.1,-.2],[1.1,.2],[1.1,.6],[.7,.6],[.35,.6],[0,.6]]);
export const FIND_EDGE_SPHERES:readonly ClimbModelSphere[]=spheres(.3,[[-.5,.5],[-.5,.3],[-.5,.1],[-.5,-.1],[-.3,.5],[-.3,.3],[-.3,.1],[-.3,-.1],
 [-.1,.5],[-.1,.3],[-.1,.1],[-.1,-.1],[.1,.5],[.1,.3],[.1,.1],[.1,-.1]]);
/** m_boundSphere of each model, in model space. */
const BOUNDS={grab:{y:.75,z:1.65,r:2.02},standUp:{y:.3,z:.7,r:1.5},vault:{y:.5,z:.1,r:1.15},edge:{y:-.2,z:.2,r:.9}};
/** ms_fHangingOffset, ms_fAtEdgeOffset, ms_fStandUpOffset and ms_fVaultOffset (horizontal, vertical). */
export const CLIMB_OFFSETS={hanging:{h:-.4,v:-1.1},atEdge:{h:-.4,v:0},standUp:{h:.15,v:1},vault:{h:.5,v:0}} as const;
type Offset={h:number;v:number};
/** ms_fMinForStretchGrab. */
export const MIN_FOR_STRETCH_GRAB=1.4;
/** Native ped forward for a heading: (−sin, cos, 0). */
export const pedForward=(heading:number):V3=>({x:-Math.sin(heading),y:Math.cos(heading),z:0});
/** GetClimbOffset3D: the horizontal offset along the heading, the vertical one up. */
export function climbOffset3D(offset:Offset,heading:number):V3{return {x:-Math.sin(heading)*offset.h,y:Math.cos(heading)*offset.h,z:offset.v};}
const add=(a:V3,b:V3):V3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});

/** The col point ProcessColModels leaves in m_aTempColPts[0]. */
export interface ClimbContact{piece:number;point:V3;normal:V3;surface?:number}
export interface ClimbEntity{kind:'building'|'object'|'vehicle'}
export interface ClimbSphere{center:V3;radius:number}
export interface ClimbWorld<E extends ClimbEntity=ClimbEntity>{
 /** Buildings, objects and vehicles (never peds) whose collision may reach the world bound sphere. */
 entities(center:V3,radius:number):Iterable<E>;
 /** The lowest-index sphere that penetrates the entity, at the entity's closest point to its centre. */
 contact(entity:E,spheres:readonly ClimbSphere[]):ClimbContact|undefined;
 /** SurfaceInfos_c::CanClimb. */
 canClimb(surface:number|undefined):boolean;
}
export interface ClimbPed{position:V3;heading:number}
export interface ClimbHold{position:V3;heading:number;surface?:number}
type Mode='grab'|'standUp'|'vault';

function placed(model:readonly ClimbModelSphere[],origin:V3,forward:V3):ClimbSphere[]{
 return model.map(s=>({center:{x:origin.x+forward.x*s.y,y:origin.y+forward.y*s.y,z:origin.z+s.z},radius:s.r}));
}
const flat=(n:V3)=>Math.abs(n.x)<=.05&&Math.abs(n.y)<=.05;

/** ScanToGrab. `at` stands in for the temporarily moved ped position; the ped keeps its own heading. In grab mode the
 * hold is updated in place and the entity that last took it is returned; the other modes return the first entity hit. */
export function scanToGrab<E extends ClimbEntity>(world:ClimbWorld<E>,ped:ClimbPed,mode:Mode,isLaunch:boolean,hold:ClimbHold,at?:V3,fatModifier=0):E|undefined{
 const position=at??ped.position,forward=pedForward(ped.heading);
 const model=mode==='vault'?VAULT_SPHERES:mode==='standUp'?STAND_UP_SPHERES:CLIMB_SPHERES,bound=BOUNDS[mode==='vault'?'vault':mode==='standUp'?'standUp':'grab'];
 hold.position={x:position.x+forward.x*10,y:position.y+forward.y*10,z:position.z};
 const scan=placed(model,position,forward);
 let collided:E|undefined;
 // A hit whose normal faces the ped (after pointing it away from the ped) turns the hold toward the surface.
 const facing=(c:ClimbContact)=>{
  let n=c.normal;if(n.x*(c.point.x-position.x)+n.y*(c.point.y-position.y)<0)n={x:-n.x,y:-n.y,z:-n.z};
  return n.x*forward.x+n.y*forward.y>.3?Math.atan2(-n.x,n.y):undefined;
 };
 for(const entity of world.entities({x:position.x+forward.x*bound.y,y:position.y+forward.y*bound.y,z:position.z+bound.z},bound.r)){
  // Grabbing a vehicle needs a boat while swimming or a stopped train, neither of which the browser has.
  if(entity.kind==='vehicle'&&mode==='grab')continue;
  const hit=world.contact(entity,scan);if(!hit)continue;
  if(mode!=='grab')return entity;
  const piece=hit.piece;
  // Something at head height or above the reach blocks the whole scan.
  if(piece<=4||piece===10)return undefined;
  const rx=hit.point.x-hold.position.x,ry=hit.point.y-hold.position.y;
  if(piece===16||hit.point.z<=hold.position.z&&rx*forward.x+ry*forward.y>=0||!world.canClimb(hit.surface))continue;
  if(!isLaunch||fatModifier>=1){
   if(piece===5||piece===11||piece===17)continue;
   if(fatModifier>=1&&(!isLaunch||fatModifier>=2)&&(piece===6||piece===12||piece===18))continue;
  }
  if(flat(hit.normal)){hold.position=hit.point;hold.heading=ped.heading;hold.surface=hit.surface;collided=entity;}
  else{const heading=facing(hit);if(heading!==undefined){hold.position=hit.point;hold.heading=heading;hold.surface=hit.surface;collided=entity;}}
  // ms_FindEdgeColModel around the hit, with the ped's orientation.
  const edge=world.contact(entity,placed(FIND_EDGE_SPHERES,hit.point,forward));
  if(edge){
   if(flat(edge.normal)){hold.position=edge.point;hold.surface=edge.surface;}
   else{const heading=facing(edge);if(heading!==undefined){hold.position=edge.point;hold.heading=heading;hold.surface=edge.surface;collided=entity;}}
  }
 }
 return collided;
}

export type ClimbTest<E>={entity:E;hold:ClimbHold}|'invalid'|undefined;
/** TestForClimb: a hold with room to stand at its edge, 'invalid' (heading −9999.9) when the edge has no room. */
export function testForClimb<E extends ClimbEntity>(world:ClimbWorld<E>,ped:ClimbPed,isLaunch:boolean,fatModifier=0):ClimbTest<E>{
 const hold:ClimbHold={position:ped.position,heading:ped.heading};
 const entity=scanToGrab(world,ped,'grab',isLaunch,hold,undefined,fatModifier);
 if(!entity)return undefined;
 const edge=add(hold.position,climbOffset3D(CLIMB_OFFSETS.atEdge,hold.heading));
 if(!scanToGrab(world,ped,'standUp',false,{position:edge,heading:hold.heading},edge))return {entity,hold};
 return 'invalid';
}
/** The height a new climb starts at: CTaskComplexJump (launch) or CTaskComplexInAirAndLand (in the air, 0.3 lower). */
export function initialClimbHeight(hold:V3,ped:V3,inAir:boolean):ClimbHeight{
 return hold.z-ped.z<MIN_FOR_STRETCH_GRAB-(inAir?.3:0)?CLIMB.PULLUP:CLIMB.GRAB;
}

/** CAnimBlendAssociation for one partial CLIMB_* clip. */
export interface ClimbAssociation{clip:ClimbClip;time:number;step:number;blend:number;delta:number;playing:boolean;speed:number}
const LOOPED=new Set<ClimbClip>(['CLIMB_idle']),FINISH_AUTO_REMOVE=new Set<ClimbClip>(['CLIMB_Stand_finish','CLIMB_jump2fall']);
export interface ClimbPedState{position:V3;heading:number;moveSpeed:V3;isPlayer:boolean}
export interface ClimbPad{jump:boolean;jumpJustDown:boolean;exitVehicle:boolean}
/** CTaskSimpleClimb on a static entity: the hold stays in world space. */
export class NativeClimbTask<E extends ClimbEntity=ClimbEntity>{
 finished=false;invalid=false;
 heightForAnim:ClimbHeight;heightForPos:ClimbHeight=CLIMB.NOT_READY;
 private changeAnimation=false;private changePosition=false;private getToPosMs=0;
 anim?:ClimbAssociation;
 /** The standing, the in-air and the landing flags the finish leaves on the ped. */
 standing=false;
 /** GetFatAndMuscleModifier(STAT_MOD_1). */
 animSpeed=1;
 constructor(readonly entity:E,readonly hold:ClimbHold,height:ClimbHeight,readonly force=false,readonly durations:Readonly<Record<ClimbClip,number>>){this.heightForAnim=height;}
 private blend(clip:ClimbClip,delta:number){
  const a=this.anim;
  if(a?.clip===clip){a.delta=(1-a.blend)*delta;if(a.time===this.durations[clip]){a.time=0;a.playing=true;}return a;}
  return this.anim={clip,time:0,step:0,blend:0,delta,playing:true,speed:1};
 }
 /** RpAnimBlendClumpUpdateAnimations for the task's association, ahead of ProcessControl. */
 updateAnim(seconds:number){
  const a=this.anim;if(!a)return;
  a.blend+=a.delta*seconds;
  if(a.blend<=0&&a.delta<0){this.anim=undefined;return;}
  if(a.blend>1){a.blend=1;a.delta=Math.min(0,a.delta);}
  if(!a.playing)return;
  a.step=a.speed*seconds;
  const total=this.durations[a.clip];
  if(a.time>=total){a.playing=false;return;}
  a.time+=a.step;
  if(a.time<total)return;
  if(LOOPED.has(a.clip)){a.time-=total;return;}
  a.time=total;
  if(FINISH_AUTO_REMOVE.has(a.clip))a.delta=-4;
 }
 private startAnim(){
  switch(this.heightForAnim){
  case CLIMB.GRAB:
   this.anim=this.anim?this.blend('CLIMB_idle',4):this.blend('CLIMB_jump',8);
   this.heightForPos=CLIMB.GRAB;break;
  case CLIMB.PULLUP:
   if(this.heightForPos===CLIMB.NOT_READY){
    this.heightForAnim=this.heightForPos=CLIMB.STANDUP;
    this.blend('CLIMB_Stand',4).playing=false;
   }else{this.blend('CLIMB_Pull',1000);this.heightForPos=CLIMB.PULLUP;}
   break;
  case CLIMB.STANDUP:this.blend('CLIMB_Stand',1000);this.changePosition=true;break;
  case CLIMB.FINISHED:case CLIMB.FINISHED_V:
   this.blend(this.heightForAnim===CLIMB.FINISHED_V?'CLIMB_jump2fall':'CLIMB_Stand_finish',1000);this.changePosition=true;break;
  case CLIMB.VAULT:this.blend('CLIMB_jump_B',this.anim?.clip==='CLIMB_Stand'?16:1000);this.changePosition=true;break;
  }
  this.changeAnimation=false;
  const a=this.anim;
  if(a&&a.playing&&(a.clip==='CLIMB_Pull'||a.clip==='CLIMB_Stand'||a.clip==='CLIMB_jump_B'))a.speed=this.animSpeed;
 }
 /** MakeAbortable: the association fades out and the ped drops. */
 abort(ped:ClimbPedState){
  if(this.anim){this.anim.delta=-4;this.anim=undefined;}
  ped.moveSpeed={x:0,y:0,z:-.05};this.finished=true;
 }
 testForStandUp(world:ClimbWorld<E>,ped:ClimbPed){
  const at=add(this.hold.position,climbOffset3D(CLIMB_OFFSETS.atEdge,this.hold.heading));
  return !scanToGrab(world,ped,'standUp',false,{position:at,heading:0},at);
 }
 testForVault(world:ClimbWorld<E>,ped:ClimbPed){
  const at=add(this.hold.position,climbOffset3D(CLIMB_OFFSETS.atEdge,this.hold.heading));
  return this.entity.kind!=='vehicle'&&!scanToGrab(world,ped,'vault',false,{position:at,heading:0},at);
 }
 private offset():Offset{
  switch(this.heightForPos){
  case CLIMB.GRAB:case CLIMB.PULLUP:return CLIMB_OFFSETS.hanging;
  case CLIMB.STANDUP:case CLIMB.VAULT:return CLIMB_OFFSETS.atEdge;
  case CLIMB.FINISHED:return CLIMB_OFFSETS.standUp;
  default:return CLIMB_OFFSETS.vault;
  }
 }
 /** ProcessPed for one frame of `timeStep` native units; sets the ped's move speed and heading. Returns true when done. */
 process(ped:ClimbPedState,pad:ClimbPad|undefined,world:ClimbWorld<E>,timeStep:number):boolean{
  if(this.finished)return true;
  if(!this.anim||this.changeAnimation)this.startAnim();
  const hand=this.hold.position,angle=this.hold.heading;
  const newHeightForPos=this.changePosition&&this.anim?.blend===1;
  if(newHeightForPos){this.heightForPos=this.heightForAnim;this.changePosition=false;}
  if(this.heightForPos>CLIMB.NOT_READY){
   const target=add(hand,climbOffset3D(this.offset(),angle));
   const delta={x:target.x-ped.position.x,y:target.y-ped.position.y,z:target.z-ped.position.z};
   if(newHeightForPos){ped.position=target;ped.moveSpeed={x:0,y:0,z:0};}
   else if(delta.x**2+delta.y**2+delta.z**2>=.1){
    this.standing=false;
    // A quarter of the gap per frame at the PC frame limiter's 30 fps.
    const share=(1-.75**(timeStep*30/50))/timeStep;
    let speed={x:delta.x*share,y:delta.y*share,z:delta.z*share};
    const magnitude=Math.hypot(speed.x,speed.y,speed.z);
    if(magnitude>.2)speed={x:speed.x*.2/magnitude,y:speed.y*.2/magnitude,z:speed.z*.2/magnitude};
    ped.moveSpeed=speed;
    const a=this.anim;
    if(a&&(!a.playing||a.clip==='CLIMB_idle')){
     this.getToPosMs+=Math.trunc(timeStep*20);
     if(this.getToPosMs>1000||a.clip==='CLIMB_idle'&&this.getToPosMs>500){
      this.invalid=true;this.abort(ped);
      const forward=pedForward(ped.heading);ped.moveSpeed={x:ped.moveSpeed.x-forward.x*.1,y:ped.moveSpeed.y-forward.y*.1,z:ped.moveSpeed.z};
     }
    }
   }else{
    this.standing=false;
    ped.moveSpeed={x:delta.x/timeStep,y:delta.y/timeStep,z:delta.z/timeStep};
    const a=this.anim;
    if(a&&!a.playing&&this.heightForAnim===CLIMB.STANDUP){
     if(this.testForVault(world,ped)){this.heightForAnim=CLIMB.VAULT;this.changeAnimation=true;}
     else a.playing=true;
    }
   }
  }
  if(newHeightForPos&&(this.heightForPos===CLIMB.FINISHED||this.heightForPos===CLIMB.FINISHED_V)){
   this.finished=true;
   const forward=pedForward(ped.heading);
   if(this.heightForPos===CLIMB.FINISHED_V){ped.moveSpeed={x:forward.x/50,y:forward.y/50,z:-.05};this.standing=false;}
   else{ped.moveSpeed={x:forward.x*.05,y:forward.y*.05,z:-.01};this.standing=true;}
   if(this.anim)this.anim.delta=-8;
   return true;
  }
  const a=this.anim;
  if(a&&a.blend===1){
   const total=this.durations[a.clip],advance=()=>{this.heightForAnim=this.heightForAnim+1 as ClimbHeight;this.changeAnimation=true;};
   switch(a.clip){
   case 'CLIMB_jump':if(total<=a.step+a.time){if(this.force||pad?.jump)advance();this.startAnim();}break;
   case 'CLIMB_idle':if(this.force||!pad||pad.jump)advance();break;
   case 'CLIMB_Pull':case 'CLIMB_Stand':if(total===a.time)advance();break;
   case 'CLIMB_jump_B':if(total<=a.step+a.time)advance();break;
   default:if(total===a.time&&(this.force||pad?.jumpJustDown))advance();
   }
  }
  const current=this.anim;
  if(pad?.exitVehicle)this.abort(ped);
  else if(this.heightForPos!==CLIMB.STANDUP&&this.heightForPos!==CLIMB.VAULT||!current||!current.playing){
   if(this.heightForAnim===CLIMB.STANDUP&&this.heightForPos<CLIMB.STANDUP&&this.testForVault(world,ped))this.heightForAnim=CLIMB.VAULT;
  }else if(!this.testForStandUp(world,ped))this.abort(ped);
  ped.heading=angle;
  return false;
 }
 /** GetCameraTargetPos: the ped position, or the hold offset the playing clip has reached. */
 cameraTarget(ped:V3):V3{
  const a=this.anim;if(!a)return ped;
  const progress=a.time/this.durations[a.clip],lerp=(from:Offset,to:Offset)=>({h:from.h+(to.h-from.h)*progress,v:from.v+(to.v-from.v)*progress});
  const o=CLIMB_OFFSETS;
  const offset=a.clip==='CLIMB_jump2fall'?o.vault:a.clip==='CLIMB_Pull'?lerp(o.hanging,o.atEdge):a.clip==='CLIMB_Stand'?lerp(o.atEdge,o.standUp)
   :a.clip==='CLIMB_Stand_finish'?o.standUp:a.clip==='CLIMB_jump_B'?lerp(o.atEdge,o.vault):undefined;
  return offset?add(this.hold.position,climbOffset3D(offset,this.hold.heading)):ped;
 }
}
