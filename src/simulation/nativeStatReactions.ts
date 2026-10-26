/* CStats::LoadActionReactionStats (0x5599B0) and the reversed CStats::UpdateStatsWhen* routines that read it, pinned
 * gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166 (Stats.cpp). AR_STATS.DAT lists "id NAME value" rows; the
 * counters are CStats' statics in milliseconds. Swimming's retail delegate is ported from independent selected-iOS
 * captures. UpdateFatAndMuscleStats remains outside this module; the host schedules these reactions once a game
 * frame while the corresponding movement task is active. */

const unsignedFloat=(value:number)=>Math.min(0xffffffff,Math.max(0,Math.trunc(value)))>>>0;

/** eStatReactionValue indices the represented routines read. */
export const AR={incSwimStamina:1,incSprintStamina:2,incRunning:3,incMotorbikeSkill:7,incBreathUnderwater:10,exerciseSwim:28,exerciseSwimSprint:29,timeLimitSwimStamina:34,timeLimitSprintStamina:35,timeLimitRunning:36,timeLimitMotorbikeSkill:40,timeLimitBreathUnderwater:44} as const;
export const STAT_STAMINA=22,STAT_LUNG_CAPACITY=225,STAT_BIKE_SKILL=229;

/** CTaskSimpleSwim::ProcessSwimAnims (PC 0x6899F0): a moving surface swimmer or any underwater state 4 trains.
 * Treading, dive-entry and jump-out alone do not train. `moveBlend` is the swim task's player move blend. */
export function swimTrainingActive(swimming:boolean,moveBlend:number,state:number){return swimming&&(moveBlend>.5||state===4);}

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
 sprintStaminaCounter=0;runningCounter=0;bikeCounter=0;swimStaminaCounter=0;underwaterCounter=0;
 constructor(private values:readonly number[],private increment:(stat:number,value:number)=>void){}
 private v(i:number){return this.values[i]??0;}
 /** CStats::UpdateStatsWhenSwimming (PC 0x55C990, retail delegate; selected iOS 0x100265a34).
  * timeStep is native 50-Hz units. Counters retain partial training out of water; each call checks the old
  * unsigned counter before adding truncated float milliseconds. The returned exercise rate is the native
  * UpdateFatAndMuscleStats argument; that separate physiology routine is not implemented here. */
 swimming(timeStep:number,underwater:boolean,sprinting:boolean){
  const f=Math.fround,ms=unsignedFloat(f(f(f(timeStep)/50)*1000));
  if(f(this.swimStaminaCounter)>f(f(this.v(AR.timeLimitSwimStamina))*1000)){
   this.swimStaminaCounter=0;const gain=f(this.v(AR.incSwimStamina));if(gain>0)this.increment(STAT_STAMINA,gain);
  }else this.swimStaminaCounter=(this.swimStaminaCounter+ms)>>>0;
  if(underwater){
   if(f(this.underwaterCounter)>f(f(this.v(AR.timeLimitBreathUnderwater))*1000)){
    this.underwaterCounter=0;const gain=f(this.v(AR.incBreathUnderwater));if(gain>0)this.increment(STAT_LUNG_CAPACITY,gain);
   }else this.underwaterCounter=(this.underwaterCounter+ms)>>>0;
  }
  return unsignedFloat(f(this.v(underwater||sprinting?AR.exerciseSwimSprint:AR.exerciseSwim)));
 }
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
