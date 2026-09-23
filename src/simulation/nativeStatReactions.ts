/* CStats::LoadActionReactionStats (0x5599B0) and the reversed CStats::UpdateStatsWhen* routines that read it, pinned
 * gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166 (Stats.cpp). AR_STATS.DAT lists "id NAME value" rows; the
 * counters are CStats' statics in milliseconds. UpdateFatAndMuscleStats, which each routine also calls, is a retail
 * stub, and so are their callers: the port runs them for every frame the player sprints, runs or rides a motorbike. */

/** eStatReactionValue indices the reversed routines read. */
export const AR={incSprintStamina:2,incRunning:3,incMotorbikeSkill:7,timeLimitSprintStamina:35,timeLimitRunning:36,timeLimitMotorbikeSkill:40} as const;
export const STAT_STAMINA=22,STAT_BIKE_SKILL=229;

/** sscanf("%d %*s %f") on every line that is not a comment or blank. */
export function readActionReactionStats(text:string){
 const values:number[]=[];
 for(const raw of text.split(/\r?\n/)){
  if(!raw||raw[0]==='#')continue;
  const m=/^\s*(-?\d+)\s+\S+\s+(-?[\d.]+)/.exec(raw);if(!m)continue;
  values[Number(m[1])]=Number(m[2]);
 }
 return values;
}

export class NativeStatReactions {
 /** m_SprintStaminaCounter, m_RunningCounter and m_BikeCounter. */
 sprintStaminaCounter=0;runningCounter=0;bikeCounter=0;
 constructor(private values:readonly number[],private increment:(stat:number,value:number)=>void){}
 private v(i:number){return this.values[i]??0;}
 /** CStats::UpdateStatsWhenSprinting (0x55C660). `timeStepMs` is CTimer::GetTimeStepInMS. */
 sprinting(timeStepMs:number){
  if(this.v(AR.timeLimitSprintStamina)*1000>=this.sprintStaminaCounter)this.sprintStaminaCounter+=Math.trunc(timeStepMs);
  else{this.sprintStaminaCounter=0;this.increment(STAT_STAMINA,this.v(AR.incSprintStamina));}
 }
 /** CStats::UpdateStatsWhenRunning (0x55C6F0). */
 running(timeStepMs:number){
  if(this.v(AR.timeLimitRunning)*1000>=this.runningCounter)this.runningCounter+=Math.trunc(timeStepMs);
  else{this.runningCounter=0;this.increment(STAT_STAMINA,this.v(AR.incRunning));}
 }
 /** CStats::UpdateStatsWhenOnMotorBike (0x55CD60): fast riding or a wheelie counts half again, steady riding half;
  * `moveSpeed` is the bike's speed in units a frame. */
 onMotorBike(timeStepMs:number,moveSpeed:number,contactWheels:number){
  if(this.v(AR.timeLimitMotorbikeSkill)*1000>=this.bikeCounter){
   if(moveSpeed>.6||contactWheels<3&&moveSpeed>.1)this.bikeCounter=Math.trunc(timeStepMs*1.5+this.bikeCounter);
   else if(moveSpeed>.2)this.bikeCounter=Math.trunc(timeStepMs*.5+this.bikeCounter);
  }else{this.bikeCounter=0;this.increment(STAT_BIKE_SKILL,this.v(AR.incMotorbikeSkill));}
 }
}
