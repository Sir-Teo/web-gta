/* Moving while aiming a gun: CTaskSimpleUseGun's move associations (TaskSimpleUseGun.cpp, reversed).
 *
 * - CTaskSimplePlayerOnFoot::PlayerControlZeldaWeapon feeds the stick / 128 (capped at length 1) to ControlGunMove
 *   (0x61E0C0), which slews each axis of m_MoveCmd by 0.07 × TimeStep. x is right, y is back (forward is negative).
 * - SetMoveAnim (0x61E3F0):
 *   - Under 0.1 of |x| + |y| (or while firing a weapon without bMoveFire), GUN_STAND blends in at 8 (the idle for
 *     weapons aimed with the arm) and the move clips stop, rewinding once the stand is past 0.95.
 *   - Aimed with the arm, the move clip of the dominant direction (x past ±0.75 picks left or right) blends in at 8.
 *   - Otherwise GUN_STAND fades by 0.16 × TimeStep and GUNMOVE_L/R and FWD/BWD take |cmd| / (|x| + |y|) of what is
 *     left, playing at weapon.dat's move speed × |cmd|.
 *   The original clears m_MoveCmd under the 0.1 threshold, which at high frame rates stops the command ever growing
 *   past it; at the PC's 30 fps a single slew already clears it, so the browser leaves the command alone.
 * - GUNMOVE clips are synchronised and extract velocity (L and R also along x), so the ped moves by their
 *   blend-weighted root travel, as in the clump update. */

export type GunMoveClip='stand'|'idle'|'fwd'|'bwd'|'left'|'right';
export const GUN_MOVES=['fwd','bwd','left','right'] as const;
const SYNCED=new Set<GunMoveClip>(GUN_MOVES);
export interface GunMoveAssociation{clip:GunMoveClip;time:number;blend:number;delta:number;playing:boolean;speed:number;autoRemove:boolean}
export interface GunMoveSegment{clip:GunMoveClip;from:number;to:number;wrapped:boolean;blend:number}
export interface GunMoveOptions{aimWithArm:boolean;moveFire:boolean;firing:boolean;moveSpeed:number}

export class NativeGunMoveAnims{
 readonly assocs=new Map<GunMoveClip,GunMoveAssociation>();
 /** m_MoveCmd. */
 cmd={x:0,y:0};
 constructor(readonly clips:Readonly<Record<GunMoveClip,{duration:number}>>){}
 private duration(clip:GunMoveClip){return this.clips[clip].duration;}
 /** CAnimManager::AddAnimation: a synchronised clip starts at the phase of the newest synchronised one on the ped. */
 private add(clip:GunMoveClip,blend:number){
  const a:GunMoveAssociation={clip,time:0,blend,delta:0,playing:true,speed:1,autoRemove:false};
  if(SYNCED.has(clip)){const newest=[...this.assocs.values()].reverse().find(m=>SYNCED.has(m.clip));if(newest)a.time=newest.time/this.duration(newest.clip)*this.duration(clip);}
  this.assocs.set(clip,a);return a;
 }
 /** CAnimManager::BlendAnimation for these non-partial clips. */
 private blendAnimation(clip:GunMoveClip,delta:number){
  let fadedOut=false;
  for(const a of this.assocs.values()){
   if(a.clip===clip)continue;
   a.delta=a.blend<=0?-1:Math.min(-.05,a.blend*-delta);a.autoRemove=true;fadedOut=true;
  }
  const running=this.assocs.get(clip);
  if(running){running.delta=(1-running.blend)*delta;return running;}
  // AddAnimationAndSync joins the moving anim's phase (the chain's last, the oldest); the clip fades in from 0 only
  // when something else was faded out.
  const moving=SYNCED.has(clip)?[...this.assocs.values()].find(m=>SYNCED.has(m.clip)):undefined;
  const a=this.add(clip,fadedOut?0:1);if(fadedOut)a.delta=delta;
  if(moving)a.time=moving.time/this.duration(moving.clip)*this.duration(clip);
  return a;
 }
 /** Fresh: standing with the gun raised. */
 start(aimWithArm:boolean){this.assocs.clear();this.cmd={x:0,y:0};this.add(aimWithArm?'idle':'stand',1);}
 /** ControlGunMove: the stick (x right, y back, each −1..1, length at most 1). */
 controlGunMove(stick:{x:number;y:number},timeStep:number){
  const max=.07*timeStep;
  this.cmd={x:Math.max(this.cmd.x-max,Math.min(this.cmd.x+max,stick.x)),y:Math.max(this.cmd.y-max,Math.min(this.cmd.y+max,stick.y))};
 }
 /** SetMoveAnim for one frame. */
 setMoveAnim(o:GunMoveOptions,timeStep:number){
  const control=!o.firing||o.moveFire;
  const distance=control?Math.hypot(this.cmd.x,this.cmd.y):0,absSum=control?Math.abs(this.cmd.x)+Math.abs(this.cmd.y):0;
  if(absSum<.1){
   // Control lost to FIRE without bMoveFire: m_MoveCmd is cleared, so the stick has to build the move up again.
   if(!control)this.cmd={x:0,y:0};
   const stand=this.blendAnimation(o.aimWithArm?'idle':'stand',8),reset=stand.blend>.95;
   // The reversed loop walks {Bwd, L, R, Bwd}: GUNMOVE_FWD is never stopped or rewound and animates on as it fades.
   for(const clip of ['bwd','left','right','bwd'] as const){const a=this.assocs.get(clip);if(a){a.playing=false;if(reset)a.time=0;}}
   return;
  }
  if(o.aimWithArm){
   const clip:GunMoveClip=this.cmd.x>.75?'right':this.cmd.x<=-.75?'left':this.cmd.y<=0?'fwd':'bwd';
   this.blendAnimation(clip,8).playing=true;
   return;
  }
  let t=1;
  const stand=this.assocs.get('stand');
  if(stand){
   if(stand.delta>=0){stand.delta=0;stand.blend=Math.max(0,stand.blend-timeStep*.16);}
   t=1-Math.max(0,Math.min(1,timeStep*stand.delta*.02+stand.blend));
  }
  const transition=(from:GunMoveClip,to:GunMoveClip,amount:number)=>{
   const f=this.assocs.get(from);if(f){f.blend=0;f.delta=0;}
   const a=this.assocs.get(to)??this.add(to,0);
   a.delta=0;a.blend=amount;a.playing=true;a.speed=o.moveSpeed*distance;a.autoRemove=false;
  };
  const lx=this.cmd.x/absSum*t,ly=this.cmd.y/absSum*t;
  if(lx<0)transition('right','left',-lx);else if(lx>0)transition('left','right',lx);
  if(ly<0)transition('bwd','fwd',-ly);else if(ly>0)transition('fwd','bwd',ly);
 }
 /** The clump update: blends, the synchronised phase rate (with each clip's speed), then times. */
 update(seconds:number):GunMoveSegment[]{
  let totalTime=0,totalBlend=0;
  for(const a of [...this.assocs.values()]){
   a.blend+=a.delta*seconds;
   if(a.blend<=0&&a.delta<0){a.blend=0;a.delta=Math.max(0,a.delta);if(a.autoRemove){this.assocs.delete(a.clip);continue;}}
   if(a.blend>1){a.blend=1;a.delta=Math.min(0,a.delta);}
   if(SYNCED.has(a.clip)&&a.speed>0){totalTime+=this.duration(a.clip)/a.speed*a.blend;totalBlend+=a.blend;}
  }
  const mult=totalTime===0?1:totalBlend/totalTime,segments:GunMoveSegment[]=[];
  for(const a of this.assocs.values()){
   if(!a.playing)continue;
   const total=this.duration(a.clip),from=a.time;
   a.time+=(SYNCED.has(a.clip)?total*mult:a.speed)*seconds;
   let wrapped=false;if(a.time>=total){a.time-=total*Math.floor(a.time/total);wrapped=true;}
   if(SYNCED.has(a.clip)&&a.blend>0)segments.push({clip:a.clip,from,to:a.time,wrapped,blend:a.blend});
  }
  return segments;
 }
 get moving(){return Math.abs(this.cmd.x)+Math.abs(this.cmd.y)>=.1;}
 poses(){return [...this.assocs.values()].filter(a=>a.blend>0).sort((a,b)=>a.blend-b.blend);}
}
