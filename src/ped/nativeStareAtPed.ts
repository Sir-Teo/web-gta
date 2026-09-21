/* CTaskComplexStareAtPed with CGroupEventHandler::ComputeStareResponse and
 * CTaskComplexGangLeader::DoGangAbuseSpeech (gta-reversed ead3051): a gang group turning on someone who walks up to
 * it. ComputeStareResponse gives the task to every member when the target is within eight units of the group's
 * leader, for a timeout of three to five seconds either side of a one-second bias (a threat instead gets a timeout
 * of a day). The task alternates CTaskSimpleStandStill of 500 to 1000 ms with CTaskComplexTurnToFaceEntityOrCoord,
 * keeps an IK look at the target's head (0.15 blend over 500 ms), says the abuse line for the target's gang, and,
 * while the leader is within eight units, plays a random partial gang talk clip one frame in a hundred when no
 * partial animation is running. It ends when the timeout runs out or the leader moves out of range. */
export const STARE_RADIUS=8,STARE_STAND_MIN_MS=500,STARE_STAND_MAX_MS=1000;
export const STARE_TIMEOUT_MIN_MS=3000,STARE_TIMEOUT_MAX_MS=5000,STARE_TIMEOUT_BIAS_MS=1000;
export const STARE_TALK_CHANCE=0.01,STARE_LOOK_BLEND=0.15,STARE_LOOK_TIME_MS=500;
export const GANG_TALK_CLIPS=['prtial_gngtlka','prtial_gngtlkb','prtial_gngtlkc','prtial_gngtlkd','prtial_gngtlke','prtial_gngtlkf','prtial_gngtlkg','prtial_gngtlkh'] as const;
/** ePedType values DoGangAbuseSpeech knows, by the browser's gang index (CIVMALE is 0 in the native enum). */
export const GANG_ABUSE_CONTEXT:Readonly<Record<number,string>>={1:'abuse_gang_ballas',2:'abuse_gang_families',4:'abuse_rifa',5:'abuse_da_nang',6:'abuse_mafia',7:'abuse_triad',8:'abuse_gang_vla'};
/** DoGangAbuseSpeech: the line a gangster says to a gang member or the player, or none for anyone else. */
export function gangAbuseContext(options:{talkerIsGangster:boolean;targetIsPlayer:boolean;targetGang?:number}){
 if(!options.talkerIsGangster)return undefined;
 if(!options.targetIsPlayer&&options.targetGang===undefined)return undefined;
 // The player counts as PED_TYPE_PLAYER1, which shares the Families line.
 if(options.targetIsPlayer)return GANG_ABUSE_CONTEXT[2];
 return GANG_ABUSE_CONTEXT[options.targetGang!];
}
/** CGeneral::GetRandomNumberInRange for integers: [min, max) as the original's exclusive form. */
const randomInt=(random:()=>number,min:number,max:number)=>Math.trunc(min+(max-1-min)*Math.min(1,Math.max(0,random())));
/** ComputeStareResponse's timeout in seconds: three to five seconds, moved by up to a second either way. */
export function stareTimeoutSeconds(random:()=>number){
 return (randomInt(random,STARE_TIMEOUT_MIN_MS,STARE_TIMEOUT_MAX_MS)+randomInt(random,-STARE_TIMEOUT_BIAS_MS,STARE_TIMEOUT_BIAS_MS))/1000;
}
/** CTaskSimpleStandStill's 500 to 1000 ms, in seconds. */
export function stareStandSeconds(random:()=>number){return randomInt(random,STARE_STAND_MIN_MS,STARE_STAND_MAX_MS)/1000;}
export interface StareState {remaining:number;phase:'stand'|'face';time:number}
/** ComputeStareResponse's range test: the target within eight units of the leader, in two dimensions. */
export function stareInRange(leader:{x:number;z:number},target:{x:number;z:number},radius=STARE_RADIUS){
 return (target.x-leader.x)**2+(target.z-leader.z)**2<radius*radius;
}
/** A frame of the task: the stand and face phases alternate while the timeout runs down. */
export function stepStare(state:StareState,dt:number,facingDone:boolean,random:()=>number){
 state.remaining-=dt;
 if(state.remaining<=0)return 'done' as const;
 if(state.phase==='stand'){
  state.time-=dt;
  if(state.time<=0){state.phase='face';state.time=0;}
  return 'stand' as const;
 }
 if(facingDone){state.phase='stand';state.time=stareStandSeconds(random);return 'stand' as const;}
 return 'face' as const;
}
/** The gang talk clip this frame, or none: one frame in a hundred while the leader is in range and nothing plays. */
export function stareTalkClip(random:()=>number,leaderInRange:boolean,partialRunning:boolean){
 if(!leaderInRange||partialRunning||random()>=STARE_TALK_CHANCE)return undefined;
 return GANG_TALK_CLIPS[Math.min(GANG_TALK_CLIPS.length-1,Math.floor(random()*GANG_TALK_CLIPS.length))];
}
