/* The player aiming a gun at a pedestrian, pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166.
 *
 * - CTaskSimplePlayerOnFoot::PlayerControlZelda (Tasks/TaskTypes/TaskSimplePlayerOnFoot.cpp) raises
 *   CEventGunAimedAt on the locked-on ped while the weapon fires instant hits, the ped can see the
 *   player and it is not already reacting.
 * - CEventGunAimedAt::AffectsPed (Events/EventGunAimedAt.cpp): alive, within its seeing range and
 *   in front of it (CPedIntelligence::IsInSeeingRange, 15 units by default), not in the player's
 *   group and not a passenger of a driven vehicle. A cop that is affected reports CRIME_AIM_GUN.
 * - CEventHandler::ComputeGunAimedAtResponse (0x4C28A0): a fleeing ped keeps fleeing; a game ped
 *   on foot holding a gun turns on an unfriendly player (CTaskComplexKillPedOnFoot); everyone else
 *   answers with the task its decision maker lists for EVENT_GUN_AIMED_AT.
 * - CTaskComplexReactToGunAimedAt (Tasks/TaskTypes/TaskComplexReactToGunAimedAt.cpp): a pause (none
 *   on foot), turn to face the aimer, then either cower and flee (pedstats flag 0x80) or say
 *   "gun cool", raise the hands for 3 to 5 s, and walk off away from the aimer for 10 s. */

type V2={x:number;z:number};

/** CPedIntelligence::m_fSeeingRange default. */
export const PED_SEEING_RANGE=15;
/** CTaskComplexWanderStandard's lifetime inside the reaction. */
export const GUN_AIMED_AT_WANDER_SECONDS=10;

/** CEventGunAimedAt::AffectsPed plus the raise conditions in PlayerControlZelda. Browser frame:
 * `forward` is the ped's facing on the ground plane. */
export function gunAimedAtAffects(o:{ped:V2&{y:number};forward:V2;aimer:V2&{y:number};alive:boolean;reacting:boolean;sameGroup?:boolean;passengerOfDrivenVehicle?:boolean;seeingRange?:number}){
 if(!o.alive||o.reacting||o.sameGroup||o.passengerOfDrivenVehicle)return false;
 const d={x:o.aimer.x-o.ped.x,y:o.aimer.y-o.ped.y,z:o.aimer.z-o.ped.z},range=o.seeingRange??PED_SEEING_RANGE;
 if(d.x*d.x+d.y*d.y+d.z*d.z>=range*range)return false;
 return d.x*o.forward.x+d.z*o.forward.z>0;
}

export type GunAimedAtResponse='flee'|'kill'|'react'|'decisionMaker';
/** ComputeGunAimedAtResponse. 'decisionMaker' means the answer lives in the decision-maker
 * data, which the browser does not have. */
export function gunAimedAtResponse(o:{fleeing:boolean;createdByGame:boolean;inVehicle:boolean;holdsGun:boolean;friendly:boolean}):GunAimedAtResponse{
 if(o.fleeing)return 'flee';
 if(o.createdByGame&&!o.inVehicle&&o.holdsGun&&!o.friendly)return 'kill';
 return 'decisionMaker';
}

/** CTaskComplexReactToGunAimedAt on foot. */
export class ReactToGunAimedAt {
 phase:'heading'|'handsUp'|'cower'|'flee'|'wander'|'done'='heading';
 time=0;
 /** CTaskSimpleHandsUp's duration: GetRandomNumberInRange(3000, 5000) ms. */
 readonly handsUpSeconds:number;
 /** pedstats `m_flags`, which the loader fills from the shooting-rate column. */
 constructor(readonly aimer:V2,private readonly pedFlags:number,randomInt:number,private readonly cowerSeconds=1){this.handsUpSeconds=(3000+randomInt%2000)/1000;}
 /** Advance by `dt` seconds. `facing` is CTaskSimpleAchieveHeading finishing. Returns the phase. */
 step(dt:number,facing:boolean){
  this.time+=dt;
  switch(this.phase){
   case 'heading':if(facing){this.phase=this.pedFlags&0x80?'cower':'handsUp';this.time=0;}break;
   // CTaskSimpleCower runs the HANDSCOWER clip once.
   case 'cower':if(this.time>=this.cowerSeconds){this.phase='flee';this.time=0;}break;
   case 'handsUp':if(this.time>=this.handsUpSeconds){this.phase='wander';this.time=0;}break;
   case 'wander':if(this.time>=GUN_AIMED_AT_WANDER_SECONDS){this.phase='done';this.time=0;}break;
  }
  return this.phase;
 }
}
