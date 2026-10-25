import {requireAsset} from '../assets/binary';
export interface BicycleHopPose {seconds:number;amount:number;released:boolean;duration:number}
/** Visual BIKE_BUNNYHOP association, driven by CBmx's existing charge/launch timer. ProcessBunnyHop holds the first
 * 0.2 seconds, releases at 1.5x, blends in at 8/s and cancels at -8/s. Finish-auto-remove fades at -4/s. */
export function stepBicycleHopPose(previous:BicycleHopPose|undefined,input:{charge:number;launchRemaining?:number;duration?:number;ridden:boolean},seconds:number):BicycleHopPose|undefined{
 const {charge,launchRemaining,duration,ridden}=input;
 requireAsset(Number.isFinite(seconds)&&seconds>=0&&Number.isFinite(charge)&&charge>=0&&charge<=25,'Invalid bicycle hop pose.');
 requireAsset(launchRemaining===undefined||Number.isFinite(launchRemaining),'Invalid bicycle hop release.');
 requireAsset(duration===undefined||Number.isFinite(duration)&&duration>0,'Invalid bicycle hop duration.');
 const active=ridden&&(charge>0||launchRemaining!==undefined)&&duration!==undefined&&duration>.2;
 if(active){
  const released=launchRemaining!==undefined,time=released?duration-Math.max(0,launchRemaining)*1.5:.2*charge/25;
  return {seconds:Math.max(0,Math.min(duration,time)),amount:Math.min(1,(previous?.amount??0)+8*seconds),released,duration};
 }
 if(!previous)return undefined;
 const finished=ridden&&previous.released,amount=Math.max(0,previous.amount-(finished?4:8)*seconds);
 return amount>0?{...previous,seconds:finished?previous.duration:Math.min(previous.duration,previous.seconds+seconds*(previous.released?1.5:1)),amount}:undefined;
}
