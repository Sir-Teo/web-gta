import {PEDMOVE} from '../combat/nativeDamageAnim';

/* The player's side of CEventPlayerCollisionWithPed: CEventHandler::ComputePlayerCollisionWithPedResponse (0x4B8CE0,
 * reversed). By the player's and the other ped's move states it answers with CTX_GLOBAL_BUMP, a two-second look at the
 * ped, CPlayerPed::AnnoyPlayerPed, a stagger (CTaskComplexHitResponse) or a fall (CTaskComplexFallAndGetUp).
 * `inFront`: the ped is ahead of the player; `behindVictim`: the player is ahead of the ped, so it walked into him. A
 * ped following the player in formation only draws the bump line. */

export interface PlayerBumpResponse {bump:boolean;annoy:boolean;stagger:boolean;fall:boolean}
const none:PlayerBumpResponse={bump:false,annoy:false,stagger:false,fall:false};

export function playerCollisionWithPedResponse(o:{player:number;victim:number;inFront:boolean;behindVictim:boolean;playerDefend:number;victimDefend:number;follower?:boolean}):PlayerBumpResponse{
 if(o.follower)return {...none,bump:true};
 const moving=(m:number)=>m===PEDMOVE.walk||m===PEDMOVE.run||m===PEDMOVE.sprint,fast=(m:number)=>m===PEDMOVE.run||m===PEDMOVE.sprint;
 if(o.player===PEDMOVE.walk){
  if(o.victim===PEDMOVE.walk)return {...none,bump:true,annoy:o.behindVictim};
  return none;
 }
 if(!fast(o.player)||!moving(o.victim)){
  // Standing still, walked into by a moving ped: a stagger when it was running.
  if(o.player===PEDMOVE.still&&moving(o.victim)&&o.behindVictim)return {...none,bump:true,stagger:o.victim!==PEDMOVE.walk};
  if(fast(o.player)&&(o.victim===PEDMOVE.none||o.victim===PEDMOVE.still)&&o.inFront&&o.player===PEDMOVE.sprint)return {...none,bump:true};
  return none;
 }
 // Both on the move, the player running or sprinting.
 if(!o.inFront&&o.behindVictim||!o.behindVictim)return {...none,bump:true,annoy:true};
 if(o.victim===PEDMOVE.walk)return none;
 // Head on into a running ped: the weaker of the two by pedstats defend weakness goes down.
 const p=o.playerDefend,v=o.victimDefend;
 if((p<=1.5||v<=1.5)&&p<=1.5||p<=v)return {...none,bump:true,annoy:true,stagger:o.player===PEDMOVE.sprint};
 return {...none,annoy:true,fall:true};
}
