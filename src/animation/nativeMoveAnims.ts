/* The player's on-foot movement associations.
 *
 * - CPlayerPed::SetRealMoveAnim (0x60A9C0) is a retail stub in the pinned gta-reversed, so its logic follows the Vice
 *   City ancestor (reVC CPlayerPed::SetRealMoveAnim). VC's m_fMoveSpeed is SA's m_fMoveBlendRatio: both come from the
 *   stick through PlayerControlZelda (pad magnitude / 60, 0.07 × TimeStep per frame).
 *   - From idle, WALK_start plays alone; walk and run restart when it ends.
 *   - Below ratio 1 the ped walks; from 1 to 2 walk blends into run; above 2 it runs.
 *   - Sprinting blends SPRINT in at 2 per second against run. Letting go of sprint fades it at 1 per second.
 *   - Stopping from a sprint plays Run_stop (or Run_stopR past half the cycle) to its end; stopping otherwise blends the
 *     idle in at 4 per second.
 * - The associations follow the reversed CAnimManager::BlendAnimation / AddAnimation and CAnimBlendAssociation
 *   UpdateBlend / UpdateTime. WALK, RUN and SPRINT are synchronised (RpAnimBlendClumpUpdateAnimations advances them at
 *   one phase rate, Σ blend / Σ blend × length), and a newly blended one joins the moving anim's phase
 *   (AddAnimationAndSync).
 * - The extracted velocity is the blend-weighted sum of each extracting clip's forward root travel over the frame
 *   (FrameUpdateCallBackSkinnedWithVelocityExtraction), not normalised by the total blend.
 * Not reproduced: the tired idle (IDLE_tired, a partial clip), adrenaline and fixed-camera sprint speeds, and
 * CPlayerPed::ControlButtonSprint's tapping (a stub); a held sprint plays at speed 1. */

export type MoveClip='idle'|'walkStart'|'walk'|'run'|'sprint'|'runStop'|'runStopR';
export interface MoveClipInfo{duration:number}
/** ped.ifp flags (AnimAssocDescriptions.h): looped, synchronised and velocity-extracting. */
const LOOPED=new Set<MoveClip>(['idle','walk','run','sprint']),SYNCED=new Set<MoveClip>(['walk','run','sprint']);
export const MOVE_EXTRACTS=new Set<MoveClip>(['walkStart','walk','run','sprint','runStop','runStopR']);
/** ANIMATION_IS_BLEND_AUTO_REMOVE: every one of these is deleted once faded out. */
export interface MoveAssociation{clip:MoveClip;time:number;step:number;blend:number;delta:number;playing:boolean;autoRemove:boolean}
/** One frame of an extracting association's time, weighted by its blend, for the caller's root-motion sum. */
export interface MoveSegment{clip:MoveClip;from:number;to:number;wrapped:boolean;blend:number}
export type MoveState='still'|'walk'|'run'|'sprint';

export class NativeMoveAnims{
 readonly assocs=new Map<MoveClip,MoveAssociation>();
 moveState:MoveState='still';
 /** m_headingRate is zeroed while a run stop plays (RestoreHeadingRate puts it back). */
 headingLocked=false;
 constructor(readonly clips:Readonly<Record<MoveClip,MoveClipInfo>>){this.add('idle');}
 private duration(clip:MoveClip){return this.clips[clip].duration;}
 /** CAnimManager::AddAnimation: a fresh association at full blend, playing from 0, or for a synchronised clip at the
  * phase of the newest synchronised one already on the ped (AddAnimationToClump prepends, so it is the list's first). */
 private add(clip:MoveClip){
  const a:MoveAssociation={clip,time:0,step:0,blend:1,delta:0,playing:true,autoRemove:false};
  if(SYNCED.has(clip)){const newest=[...this.assocs.values()].reverse().find(m=>SYNCED.has(m.clip));if(newest)a.time=newest.time/this.duration(newest.clip)*this.duration(clip);}
  this.assocs.set(clip,a);return a;
 }
 private remove(clip:MoveClip){this.assocs.delete(clip);}
 /** CTaskSimplePlayerOnFoot::MakeAbortable at ABORT_PRIORITY_IMMEDIATE: BlendAnimation(IDLE, 1000), idle at once with
  * the walk, run, sprint and stop clips gone and the heading rate back. */
 reset(){this.assocs.clear();this.add('idle');this.headingLocked=false;this.moveState='still';}
 /** CAnimManager::BlendAnimation for these non-partial clips. */
 private blendAnimation(clip:MoveClip,delta:number){
  let fadedOut=false;
  for(const a of this.assocs.values()){
   if(a.clip===clip)continue;
   if(a.blend<=0)a.delta=-1;
   else a.delta=Math.min(-.05,a.blend*-delta);
   a.autoRemove=true;fadedOut=true;
  }
  const running=this.assocs.get(clip);
  if(running){running.delta=(1-running.blend)*delta;if(running.time===this.duration(clip)){running.time=0;running.playing=true;}return running;}
  // AddAnimationAndSync: a synchronised clip joins the moving anim's phase (the chain's last, the oldest). It fades in
  // from 0 when something else was faded out, else starts at full blend.
  const moving=SYNCED.has(clip)?[...this.assocs.values()].find(m=>SYNCED.has(m.clip)):undefined;
  const a=this.add(clip);
  if(fadedOut){a.blend=0;a.delta=delta;}
  if(moving)a.time=moving.time/this.duration(moving.clip)*this.duration(clip);
  return a;
 }
 /** RpAnimBlendClumpUpdateAnimations: blends, synchronised time steps, then times. Returns the extracting segments. */
 update(seconds:number):MoveSegment[]{
  let totalTime=0,totalBlend=0;
  for(const a of [...this.assocs.values()]){
   a.blend+=a.delta*seconds;
   if(a.blend<=0&&a.delta<0){a.blend=0;a.delta=Math.max(0,a.delta);if(a.autoRemove){this.remove(a.clip);continue;}}
   if(a.blend>1){a.blend=1;a.delta=Math.min(0,a.delta);}
   if(SYNCED.has(a.clip)){totalTime+=this.duration(a.clip)*a.blend;totalBlend+=a.blend;}
  }
  const mult=totalTime===0?1:totalBlend/totalTime,segments:MoveSegment[]=[];
  for(const a of this.assocs.values()){
   if(!a.playing)continue;
   a.step=(SYNCED.has(a.clip)?this.duration(a.clip)*mult:1)*seconds;
   const total=this.duration(a.clip),from=a.time;
   if(a.time>=total){a.playing=false;continue;}
   a.time+=a.step;let wrapped=false;
   if(a.time>=total){
    if(LOOPED.has(a.clip)){a.time-=total;wrapped=true;}
    else a.time=total;
   }
   if(MOVE_EXTRACTS.has(a.clip)&&a.blend>0)segments.push({clip:a.clip,from,to:a.time,wrapped,blend:a.blend});
  }
  return segments;
 }
 /** CPlayerPed::SetRealMoveAnim for the current move blend ratio and sprint request. */
 setRealMoveAnim(ratio:number,sprint:boolean){
  let walk=this.assocs.get('walk'),run=this.assocs.get('run'),sprintAssoc=this.assocs.get('sprint'),walkStart=this.assocs.get('walkStart'),idle=this.assocs.get('idle');
  const runStop=this.assocs.get('runStop'),runStopR=this.assocs.get('runStopR');
  // CPlayerPed::ProcessControl resets the state to still each frame; PlayerControlZelda sets sprint while it is held.
  this.moveState=sprint?'sprint':'still';
  // A run stop plays to its end untouched.
  if(runStop?.playing||runStopR?.playing)return;
  if(runStop&&runStop.delta>=0||runStopR&&runStopR.delta>=0){
   const stop=runStop??runStopR!;stop.autoRemove=true;stop.blend=1;stop.delta=-8;
   this.headingLocked=false;
   idle??=this.blendAnimation('idle',8);
   idle.blend=0;idle.delta=8;
   return;
  }
  if(ratio===0&&!sprintAssoc){
   if(!idle)this.blendAnimation('idle',4);
   this.moveState='still';
   return;
  }
  if(idle){
   // Starting off: WALK_start plays alone from the idle pose.
   if(walkStart){walkStart.blend=1;walkStart.delta=0;}else walkStart=this.add('walkStart');
   if(walk)walk.time=0;
   if(run)run.time=0;
   this.remove('idle');
   if(sprintAssoc){this.remove('sprint');sprintAssoc=undefined;}
   this.moveState='walk';
  }
  if(runStop){this.remove('runStop');this.headingLocked=false;}
  if(runStopR){this.remove('runStopR');this.headingLocked=false;}
  if(!walk){walk=this.add('walk');walk.blend=0;}
  if(!run){run=this.add('run');run.blend=0;}
  if(walkStart&&!walkStart.playing){this.remove('walkStart');walkStart=undefined;walk.playing=true;run.playing=true;}
  if(this.moveState==='sprint'&&walkStart)this.moveState='still';
  if(sprintAssoc&&(this.moveState!=='sprint'||ratio<.4)){
   if(sprintAssoc.blend===0){sprintAssoc.delta=-1000;sprintAssoc.autoRemove=true;}
   else if(sprintAssoc.delta>=0||sprintAssoc.blend>=.8){
    if(ratio<.4){
     const right=sprintAssoc.time/this.duration('sprint')>=.5,stop=this.add(right?'runStopR':'runStop');
     stop.autoRemove=true;this.headingLocked=true;
     this.remove('sprint');
     walk.playing=false;walk.blend=0;walk.delta=0;
     run.playing=false;run.blend=0;run.delta=0;
    }else if(sprintAssoc.delta>=0){
     // Letting go of sprint: SPRINT fades over a second while RUN comes back.
     sprintAssoc.autoRemove=true;sprintAssoc.delta=-1;run.delta=1;
    }
   }else if(ratio<1){sprintAssoc.delta=-8;run.delta=8;}
  }else if(walkStart){
   walk.playing=false;run.playing=false;walk.blend=0;run.blend=0;
  }else if(this.moveState==='sprint'){
   if(sprintAssoc){if(sprintAssoc.delta<0){sprintAssoc.delta=2;run.delta=-2;}}
   else{walk.blend=0;run.blend=1;this.blendAnimation('sprint',2);}
  }else{
   if(ratio<1){walk.blend=1;run.blend=0;this.moveState='walk';}
   else if(ratio<2){walk.blend=2-ratio;run.blend=ratio-1;this.moveState='run';}
   else{walk.blend=0;run.blend=1;this.moveState='run';}
   walk.delta=0;run.delta=0;
  }
 }
 /** The associations to draw, heaviest last. */
 poses(){return [...this.assocs.values()].filter(a=>a.blend>0).sort((a,b)=>a.blend-b.blend);}
}
