import {requireAsset} from '../assets/binary';
export interface BicycleHopAssociation {
 seconds:number;duration:number;amount:number;blendDelta:number;speed:number;playing:boolean;released:boolean;launchPending:boolean;
}
export interface BicycleHopState {charge:number;animation?:BicycleHopAssociation}
/** PC CBmx::ProcessBunnyHop (0x6C0590), followed by the association's blend/time update (0x4D1490/0x4D13D0).
 * The clip's finish callback emits launchCharge once; its FINISH_AUTO_REMOVE fade owns rearming. */
export function stepNativeBicycleHop(previous:BicycleHopState,input:{pressed:boolean;held:boolean;disabled?:boolean;ridden:boolean;duration?:number},dt:number){
 requireAsset(Number.isFinite(dt)&&dt>=0&&Number.isFinite(previous.charge)&&previous.charge>=0&&previous.charge<=25,'Invalid bicycle hop state.');
 requireAsset(input.duration===undefined||Number.isFinite(input.duration)&&input.duration>.2,'Invalid bicycle hop clip.');
 let charge=previous.charge,animation=previous.animation?{...previous.animation}:undefined,launchCharge:number|undefined;
 if(!input.ridden){
  charge=0;if(animation){animation.playing=true;animation.blendDelta=-8;animation.launchPending=false;}
 }else if(input.disabled){
  // The browser has no native task manager to remove the player's interrupted secondary association.
  charge=0;if(animation){animation.playing=true;animation.blendDelta=-8;animation.launchPending=false;}
 }else{
  if(input.pressed&&charge===0&&input.duration!==undefined){
   charge+=dt*50;
   animation={seconds:0,duration:animation?.duration??input.duration,amount:animation?.amount??0,blendDelta:8,speed:1,playing:false,released:false,launchPending:false};
  }
  if(charge>0){
   if(!animation)charge=0;
   else if(input.held){
    if(!animation.playing){charge=Math.min(charge+dt*50,25);animation.seconds=charge/25*.2;}
   }else if(!animation.playing){
    if(animation.seconds<.2)animation.seconds=(.2-animation.seconds)/.2*(animation.duration-.2)+.2;
    animation.playing=true;animation.released=true;animation.speed=1.5;animation.launchPending=true;
   }
  }
 }
 // ProcessBunnyHop reads the existing association blend before the animation manager advances it.
 const cutGas=!!animation&&animation.amount>.5;
 if(animation){
  animation.amount=Math.max(0,Math.min(1,animation.amount+animation.blendDelta*dt));
  if(animation.amount===0&&animation.blendDelta<0)animation=undefined;
  else if(animation.playing){
   if(animation.seconds>=animation.duration)animation.playing=false;
   else{
    animation.seconds+=animation.speed*dt;
    if(animation.seconds>=animation.duration){
     animation.seconds=animation.duration;animation.blendDelta=-4;
     if(animation.launchPending){launchCharge=charge;animation.launchPending=false;}
    }
   }
  }
 }
 return {state:{charge,animation} as BicycleHopState,launchCharge,cutGas};
}
