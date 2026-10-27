/* CStats::LoadActionReactionStats (0x5599B0) and the reversed CStats::UpdateStatsWhen* routines that read it, pinned
 * gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166 (Stats.cpp). AR_STATS.DAT lists "id NAME value" rows; the
 * counters are CStats' statics in milliseconds. Swimming's retail delegate is ported from independent selected-iOS
 * captures. The host's optional onExercise handler runs the captured body routine before training awards,
 * once a game frame while the corresponding movement task is active. */

const unsignedFloat=(value:number)=>Math.min(0xffffffff,Math.max(0,Math.trunc(value)))>>>0;

/** eStatReactionValue indices the represented routines read. */
export const AR={incSwimStamina:1,incSprintStamina:2,incRunning:3,incMotorbikeSkill:7,incBreathUnderwater:10,exerciseSwim:28,exerciseSwimSprint:29,exerciseSprint:30,exerciseRun:31,timeLimitSwimStamina:34,timeLimitSprintStamina:35,timeLimitRunning:36,timeLimitMotorbikeSkill:40,timeLimitBreathUnderwater:44} as const;
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
 /** Ground/swim training counters; motorbike and cycling own their captured controllers. */
 sprintStaminaCounter=0;runningCounter=0;swimStaminaCounter=0;underwaterCounter=0;
 /** Native UpdateStatsWhen* calls body exercise before awarding its own stamina/lung gain. */
 onExercise?:(timeStep:number,rate:number)=>void;
 constructor(private values:readonly number[],private increment:(stat:number,value:number)=>void){}
 private v(i:number){return this.values[i]??0;}
 /** CStats::UpdateStatsWhenSwimming (PC 0x55C990, retail delegate; selected iOS 0x100265a34).
  * timeStep is native 50-Hz units. Counters retain partial training out of water; each call checks the old
  * unsigned counter before adding truncated float milliseconds. The exercise handler receives the native
  * UpdateFatAndMuscleStats argument first; the rate remains available to observers. */
 swimming(timeStep:number,underwater:boolean,sprinting:boolean){
  const f=Math.fround,ms=unsignedFloat(f(f(f(timeStep)/50)*1000)),rate=unsignedFloat(f(this.v(underwater||sprinting?AR.exerciseSwimSprint:AR.exerciseSwim)));
  this.onExercise?.(timeStep,rate);
  if(f(this.swimStaminaCounter)>f(f(this.v(AR.timeLimitSwimStamina))*1000)){
   this.swimStaminaCounter=0;const gain=f(this.v(AR.incSwimStamina));if(gain>0)this.increment(STAT_STAMINA,gain);
  }else this.swimStaminaCounter=(this.swimStaminaCounter+ms)>>>0;
  if(underwater){
   if(f(this.underwaterCounter)>f(f(this.v(AR.timeLimitBreathUnderwater))*1000)){
    this.underwaterCounter=0;const gain=f(this.v(AR.incBreathUnderwater));if(gain>0)this.increment(STAT_LUNG_CAPACITY,gain);
   }else this.underwaterCounter=(this.underwaterCounter+ms)>>>0;
  }
  return rate;
 }
 /** CStats::UpdateStatsWhenSprinting (PC 0x55C660; selected iOS 0x100265518).
  * The host supplies milliseconds; restore native 50-Hz units before native float conversion. */
 sprinting(timeStepMs:number){
  this.groundTraining(timeStepMs,'sprintStaminaCounter',AR.exerciseSprint,AR.timeLimitSprintStamina,AR.incSprintStamina);
 }
 /** CStats::UpdateStatsWhenRunning (PC 0x55C6F0; selected iOS 0x100265644). */
 running(timeStepMs:number){
  this.groundTraining(timeStepMs,'runningCounter',AR.exerciseRun,AR.timeLimitRunning,AR.incRunning);
 }
 private groundTraining(timeStepMs:number,counter:'sprintStaminaCounter'|'runningCounter',exercise:number,limit:number,increment:number){
  const f=Math.fround,timeStep=f(timeStepMs/20);
  this.onExercise?.(timeStep,unsignedFloat(f(this.v(exercise))));
  if(f(this[counter])>f(f(this.v(limit))*1000)){
   this[counter]=0;const gain=f(this.v(increment));if(gain>0)this.increment(STAT_STAMINA,gain);
  }else{
   const ms=unsignedFloat(f(f(timeStep/50)*1000));this[counter]=(this[counter]+ms)>>>0;
  }
 }
}
