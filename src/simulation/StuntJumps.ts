import type {ScmStuntJump} from '../assets/scmStuntJumps';
export type NativePoint={x:number;y:number;z:number};
/** What CStuntJumpManager::Update reads from the player and the vehicle it drives, in native units. */
export interface StuntJumpInput {
 /** The player is PLAYERSTATE_PLAYING and drives a car (boats, planes and helicopters are excluded). */
 driving:boolean;
 position:NativePoint;
 /** m_vecMoveSpeed, native units per frame. */
 moveSpeed:NativePoint;
 /** CPhysical::m_nNumEntitiesCollided this frame. */
 collided:number;
 /** The car is wrecked, drowning or submerged. */
 lost:boolean;
}
export type StuntJumpState='waiting'|'flight'|'landed';
/** The slow-motion camera and reward a completed jump raises. */
export interface StuntJumpEvents {
 onStart?:(jump:ScmStuntJump)=>void;
 onEnd?:()=>void;
 onReward?:(jump:ScmStuntJump,reward:number,all:boolean)=>void;
}
const within=(box:{min:readonly number[];max:readonly number[]},p:NativePoint)=>p.x>=box.min[0]&&p.x<=box.max[0]&&p.y>=box.min[1]&&p.y<=box.max[1]&&p.z>=box.min[2]&&p.z<=box.max[2];
/** CStuntJumpManager (gta-reversed 0076f901, 0x49C490): the unique stunt jumps the INITIAL script adds. Entering a start box
 * airborne above 20 m/s slows time to 0.3 and fixes the camera; reaching the landing box before touching anything pays the reward. */
export class StuntJumps {
 /** CStuntJumpManager::m_bActive. */
 active=true;
 state:StuntJumpState='waiting';
 /** Jumps found (entered) and completed, by save id. */
 readonly found=new Set<string>();readonly done=new Set<string>();
 private current?:ScmStuntJump;private timer=0;private hitReward=false;
 constructor(readonly jumps:readonly ScmStuntJump[],private events:StuntJumpEvents={}){}
 get completed(){return this.done.size;}
 get timeScale(){return this.state==='waiting'?1:.3;}
 snapshot(){return {state:this.state,jumps:this.jumps.length,found:this.found.size,done:this.done.size,current:this.current?.id??null,timer:Math.round(this.timer),hitReward:this.hitReward};}
 /** One frame of Update. `timeStepMs` is CTimer::GetTimeStepInMS (game time, so already slowed while a jump runs). */
 update(timeStepMs:number,input:StuntJumpInput){
  switch(this.state){
  case 'waiting':{
   if(!this.active||!input.driving||input.collided>0)return;
   if(Math.hypot(input.moveSpeed.x,input.moveSpeed.y,input.moveSpeed.z)*50<20)return;
   const jump=this.jumps.find(j=>within(j.start,input.position));if(!jump)return;
   this.state='flight';this.current=jump;this.timer=0;this.hitReward=false;
   if(!this.found.has(jump.id))this.found.add(jump.id);
   this.events.onStart?.(jump);
   return;
  }
  case 'flight':{
   const jump=this.current;if(!jump){this.state='waiting';return;}
   const failed=input.collided!==0&&this.timer>=100;
   if(!failed&&within(jump.end,input.position))this.hitReward=true;
   const ended=failed||!input.driving||input.lost;
   if(ended)this.state='landed';
   this.timer=(ended?0:this.timer)+timeStepMs;
   return;
  }
  case 'landed':{
   this.timer+=timeStepMs;
   if(this.timer<300)return;
   const jump=this.current;this.events.onEnd?.();
   if(jump&&this.hitReward&&!this.done.has(jump.id)){
    this.done.add(jump.id);
    const all=this.done.size===this.jumps.length,reward=all?10000:jump.reward;
    this.events.onReward?.(jump,reward,all);
   }
   this.state='waiting';this.current=undefined;
   return;
  }
  }
 }
}
