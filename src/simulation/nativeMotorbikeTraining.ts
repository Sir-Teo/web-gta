const f=Math.fround;
const uFloat=(n:number)=>Math.min(0xffffffff,Math.max(0,Math.trunc(n)))>>>0;
const iFloat=(n:number)=>Math.min(0x7fffffff,Math.max(-0x80000000,Math.trunc(n)))|0;
const nativeSpeedSquared=(velocity:readonly [number,number,number])=>{const [x,y,z]=velocity.map(f);return f(f(f(x*x)+f(y*y))+f(z*z));};
/** Selected CPlayerInfo dispatch compares native squared speed with exact zero, including float32 underflow. */
export function motorbikeTrainingMoving(velocity:readonly [number,number,number]){return nativeSpeedSquared(velocity)>0;}
export interface MotorbikeTrainingInput {
 /** Native x/y/z move speed in units per 50-Hz frame. */
 velocity:readonly [number,number,number];
 /** CBike's native count of four suspension-line contact points. */
 contactWheels:number;
 /** Raw integer stat 229, before GetStatValue's float32 conversion. */
 skill:number;
}
/** CStats::UpdateStatsWhenOnMotorBike (PC 0x55CD60; selected iOS 0x100265f94).
 * CPlayerInfo schedules this for a moving motorbike. Idle time preserves partial work. */
export class NativeMotorbikeTraining {
 counter=0;
 constructor(private readonly values:readonly number[]){}
 step(timeStep:number,input:MotorbikeTrainingInput,showUpdates=true){
  const value=(i:number)=>f(this.values[i]??0);let skill=input.skill|0,checks=0;
  const messages:{increase:boolean;stat:number;value:number;max:number}[]=[];
  if(f(this.counter)>f(value(40)*1000)){
   this.counter=0;const gain=value(7);
   if(gain>0){skill=iFloat(Math.min(1000,f((skill+iFloat(gain))|0)));checks++;}
   if(showUpdates&&gain>1&&skill<1000)messages.push({increase:true,stat:229,value:gain,max:1000});
  }else{
   const speed=f(Math.sqrt(nativeSpeedSquared(input.velocity)));
   const scale=speed>f(.6)||(input.contactWheels&255)<3&&speed>f(.1)?1.5:speed>f(.2)?.5:0;
   if(scale){const ms=uFloat(f(f(f(timeStep)/50)*1000));this.counter=uFloat(f(f(this.counter)+f(f(ms)*scale)));}
  }
  return {skill,checks,messages};
 }
}
