const f=Math.fround;
const uFloat=(value:number)=>Math.min(0xffffffff,Math.max(0,Math.trunc(value)))>>>0;
export interface BodyExerciseStats {fat:number;muscle:number;maxHealth:number}
export interface ExerciseMessage {increase:boolean;stat:number;value:number;max:number}
/** CStats::UpdateFatAndMuscleStats (PC 0x55C470 delegate; selected iOS 0x100265280).
 * Native counters and message alternation survive pauses between exercising tasks. */
export class NativeBodyExercise {
 fatCounter=0;healthCounter=0;messageState=0;
 constructor(private readonly values:readonly number[]){}
 private v(index:number){return f(this.values[index]??0);}
 step(timeStep:number,exerciseRate:number,stats:BodyExerciseStats,showUpdates=true){
  stats.fat=f(stats.fat);stats.muscle=f(stats.muscle);stats.maxHealth=f(stats.maxHealth);
  const ms=uFloat(f(f(f(timeStep)/50)*1000)),messages:ExerciseMessage[]=[];let checks=0;
  const message=(increase:boolean,stat:number,amount:number,current:number)=>{if(amount>1&&showUpdates&&current<1000)messages.push({increase,stat,value:amount,max:1000});};
  if(f(this.fatCounter)>f(this.v(42)*1000)){
   this.fatCounter=0;
   if(stats.fat>0){
    if(this.v(23)>0){stats.fat=Math.max(0,f(stats.fat-this.v(23)));checks++;}
    if(this.v(9)>0){stats.muscle=Math.min(1000,f(stats.muscle+this.v(9)));checks++;}
    if(this.messageState===1){this.messageState=2;message(true,23,this.v(9),stats.muscle);}
    else{this.messageState=1;message(false,21,this.v(23),stats.fat);}
   }else{
    if(this.v(24)>0){stats.muscle=Math.max(0,f(stats.muscle-this.v(24)));checks++;}
    this.messageState=3;message(false,23,this.v(24),stats.muscle);
   }
  }else this.fatCounter=(this.fatCounter+Math.floor((Math.imul(ms,exerciseRate>>>0)>>>0)/10))>>>0;
  if(f(this.healthCounter)>f(this.v(45)*1000)){
   if(this.v(11)>0){stats.maxHealth=Math.min(1000,f(stats.maxHealth+this.v(11)));checks++;}
   this.healthCounter=0;message(true,24,this.v(11),stats.maxHealth);
  }else this.healthCounter=(this.healthCounter+ms)>>>0;
  return {checks,messages};
 }
}
/** Apply native direct stat writes through the host's authoritative store (including saved bindings).
 * This avoids IncrementStat's unrelated reaction paths; native feedback remains an explicit result. */
export function applyBodyExercise(exercise:NativeBodyExercise,timeStep:number,exerciseRate:number,store:{get(stat:number):number;set(stat:number,value:number):void},showUpdates=true){
 const before={fat:store.get(21),muscle:store.get(23),maxHealth:store.get(24)},stats={...before};
 const result=exercise.step(timeStep,exerciseRate,stats,showUpdates);
 if(stats.fat!==before.fat)store.set(21,stats.fat);
 if(stats.muscle!==before.muscle)store.set(23,stats.muscle);
 if(stats.maxHealth!==before.maxHealth)store.set(24,stats.maxHealth);
 return result;
}
