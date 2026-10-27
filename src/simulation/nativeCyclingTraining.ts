import type {ExerciseMessage} from './nativeBodyExercise';
const f=Math.fround;
const uFloat=(n:number)=>Math.min(0xffffffff,Math.max(0,Math.trunc(n)))>>>0;
const iFloat=(n:number)=>Math.min(0x7fffffff,Math.max(-0x80000000,Math.trunc(n)))|0;
export interface CyclingTrainingInput {
 gas:number;boost:boolean;
 /** Native suspension contact-point count (0..4), rather than physical tire count. */
 contactWheels:number;
 /** Native x/y/z move speed, in units per 50-Hz frame. */
 velocity:readonly [number,number,number];
 /** Raw integer stat 230, before GetStatValue's float32 conversion. */
 skill:number;
}
interface CyclingStatStore {get(stat:number):number;set(stat:number,value:number):void;increment(stat:number,value:number):void}
/** CStats::UpdateStatsWhenCycling (PC 0x55C780 delegate; selected iOS 0x100265770).
 * Called from the active player's CBmx decision, including idle/coasting frames. */
export class NativeCyclingTraining {
 staminaCounter=0;skillCounter=0;
 /** Share the body's counters with running, sprinting and swimming, before stamina awards. */
 onExercise?:(timeStep:number,rate:number)=>void;
 constructor(private readonly values:readonly number[]){}
 step(timeStep:number,input:CyclingTrainingInput,store:CyclingStatStore,showUpdates=true){
  const value=(i:number)=>f(this.values[i]??0),ts=f(timeStep),ms=uFloat(f(f(ts/50)*1000));
  const messages:ExerciseMessage[]=[];let checks=0,skill=input.skill|0;
  if(f(input.gas)!==0||input.boost){
   this.onExercise?.(ts,uFloat(value(input.boost?27:26)));
   if(f(this.staminaCounter)>f(value(33)*1000)){
    this.staminaCounter=0;const gain=value(0);
    if(gain>0){const hungry=store.get(165)<0;store.increment(22,gain);checks+=hungry?2:1;}
    if(showUpdates&&gain>1&&store.get(22)<1000)messages.push({increase:true,stat:22,value:gain,max:1000});
   }else this.staminaCounter=(this.staminaCounter+ms)>>>0;
  }
  if(f(this.skillCounter)>f(value(39)*1000)){
   this.skillCounter=0;const gain=value(6);
   if(gain>0){skill=iFloat(Math.min(1000,f((skill+iFloat(gain))|0)));store.set(230,skill);checks++;}
   if(showUpdates&&gain>1&&skill<1000)messages.push({increase:true,stat:230,value:gain,max:1000});
  }else{
   const [x,y,z]=input.velocity.map(f),speedSquared=f(f(f(x*x)+f(y*y))+f(z*z));
   const scale=(input.contactWheels&255)<2&&speedSquared>f(f(.05)*f(.05))?3:speedSquared>f(f(.2)*f(.2))?(input.boost?1.5:1):0;
   if(scale)this.skillCounter=(this.skillCounter+uFloat(Math.ceil(f(f(ms)*scale))))>>>0;
  }
  return {skill,checks,messages};
 }
}
