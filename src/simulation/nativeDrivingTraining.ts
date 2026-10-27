const f=Math.fround;
const unsignedFloat=(n:number)=>Math.min(0xffffffff,Math.max(0,Math.trunc(n)))>>>0;
const signedFloat=(n:number)=>Math.min(0x7fffffff,Math.max(-0x80000000,Math.trunc(n)))|0;
export interface DrivingTrainingInput {
 /** CPhysical::m_vecMoveSpeed, in native x/y/z and units per 50-Hz frame. */
 velocity:readonly [number,number,number];
 automobile:boolean;contactWheels:number;
 /** Raw integer stat 160, before GetStatValue's lossy conversion to float. */
 skill:number;
}
/** CStats::UpdateStatsWhenDriving (PC 0x55CAC0 delegate; selected iOS 0x100265c70).
 * The caller schedules it while riding a moving automobile; partial counter work survives idle time. */
export class NativeDrivingTraining {
 counter=0;
 constructor(private readonly values:readonly number[]){}
 step(timeStep:number,input:DrivingTrainingInput,showUpdates=true){
  const value=(i:number)=>f(this.values[i]??0);let skill=input.skill|0,checks=0;
  const messages:{increase:boolean;stat:number;value:number;max:number}[]=[];
  if(f(this.counter)>f(value(37)*1000)){
   this.counter=0;const gain=value(4);
   if(gain>0){skill=signedFloat(Math.min(1000,f((skill+signedFloat(gain))|0)));checks++;}
   if(showUpdates&&gain>1&&skill<1000)messages.push({increase:true,stat:160,value:gain,max:1000});
  }else{
   const [x,y,z]=input.velocity.map(f),speed=f(Math.sqrt(f(f(f(x*x)+f(y*y))+f(z*z))));
   const scale=speed>f(.8)||input.automobile&&input.contactWheels===0?1.5:speed>f(.2)?.5:0;
   if(scale){const ms=unsignedFloat(f(f(f(timeStep)/50)*1000));this.counter=unsignedFloat(f(f(this.counter)+f(f(ms)*scale)));}
  }
  return {skill,checks,messages};
 }
}
