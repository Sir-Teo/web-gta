import {requireAsset} from '../assets/binary';
import {NATIVE_CAR_WHEELS,type CarWheel} from './nativeDriveContacts';

export type NativeWheelState='normal'|'spinning'|'skidding'|'fixed';
const f=(v:number)=>{const value=Math.fround(v);requireAsset(Number.isFinite(value),'Nonfinite wheel response.');return value;};
export function nativeCoastBrake(friction:number,mass:number,kind:'car'|'bike'|'plane'|'rcBandit'){
  requireAsset(Number.isFinite(friction)&&friction>=0&&Number.isFinite(mass)&&mass>0,'Invalid coast-brake input.');
  requireAsset(['car','bike','plane','rcBandit'].includes(kind),'Invalid coast-brake vehicle kind.');
  if(kind==='plane')return 0;
  if(kind==='bike')return f(f(f(friction)*f(.6))/f(f(mass)+200));
  let brake=f(f(friction)/f(mass));
  if(brake>500)brake=f(brake*f(.1));else if(kind==='rcBandit')brake=f(brake*f(.2));
  return brake;
}
export interface NativeWheelInput {
  wheel:CarWheel;previousState:NativeWheelState;
  /** Explicit shared source latch: its lifetime is not silently made per-wheel. */
  alreadySkidding:boolean;
  forwardSpeed:number;rightSpeed:number;contactCount:number;
  thrust:number;brake:number;coastBrake:number;adhesion:number;tractionLoss:number;
  throttle:number;timeStep:number;playerControlled:boolean;antiDive:number;
  burst?:boolean;
  /** Caller-supplied random sample in [-.13,.13], consumed only for lateral burst response. */
  burstNoise?:number;
}

/** Scalar contact response in the wheel's projected forward/right basis. These
 * are native velocity increments; converting them into body impulses is separate. */
export function nativeWheelResponse(input:NativeWheelInput){
  requireAsset(NATIVE_CAR_WHEELS.includes(input.wheel)&&['normal','spinning','skidding','fixed'].includes(input.previousState),'Invalid wheel identity or state.');
  requireAsset(Number.isInteger(input.contactCount)&&input.contactCount>=1&&input.contactCount<=4,'Invalid wheel contact count.');
  for(const key of ['brake','coastBrake','adhesion','tractionLoss','antiDive','timeStep'] as const)requireAsset(Number.isFinite(input[key])&&input[key]>=0,`Invalid wheel ${key}.`);
  requireAsset(input.timeStep<=3&&Number.isFinite(input.throttle)&&Math.abs(input.throttle)<=1,'Invalid wheel timestep or throttle.');
  const forwardSpeed=f(input.forwardSpeed),rightSpeed=f(input.rightSpeed),thrust=f(input.thrust),throttle=f(input.throttle),loss=f(input.tractionLoss);
  let brake=f(input.brake);
  const braking=brake!==0,driving=!braking&&thrust!==0;
  let adhesion=f(f(input.adhesion)*f(input.timeStep)),alreadySkidding=input.alreadySkidding;
  if(input.previousState!=='normal'){
    alreadySkidding=true;adhesion=f(adhesion*loss);
    if(input.previousState==='spinning'&&input.playerControlled)adhesion=f(adhesion*f(1-f(Math.abs(throttle)*f(.2))));
  }
  let state:NativeWheelState='normal',forward=0,right=0;
  if(rightSpeed!==0){
    right=f(-f(rightSpeed/input.contactCount));
    if(input.burst){
      requireAsset(Number.isFinite(input.burstNoise)&&Math.abs(input.burstNoise!)<=.13,'Burst wheel response requires a bounded random sample.');
      right=f(right+f(Math.min(forwardSpeed,f(.3))*f(input.burstNoise!)));
    }
  }
  if(driving){forward=thrust;right=Math.max(-adhesion,Math.min(adhesion,right));}
  else if(forwardSpeed!==0){
    forward=f(-f(forwardSpeed/input.contactCount));
    if(!braking&&Math.abs(throttle)<f(.01))brake=f(input.coastBrake);
    if(brake>adhesion){if(Math.abs(forwardSpeed)>f(.005))state='fixed';}
    else forward=Math.max(-brake,Math.min(brake,forward));
  }
  const squared=f(f(right*right)+f(forward*forward));
  if(squared>f(adhesion*adhesion)){
    if(state!=='fixed'){
      let threshold=f(.3);if(forwardSpeed>f(.15)&&input.wheel.startsWith('front'))threshold=f(threshold+threshold);
      state=driving&&f(threshold*adhesion)<Math.abs(forward)?'spinning':'skidding';
    }
    let tractionLoss=loss;
    if(alreadySkidding)tractionLoss=1;
    else if(state==='spinning'&&input.playerControlled)tractionLoss=f(tractionLoss*f(1-f(Math.abs(throttle)*f(.2))));
    const length=f(Math.sqrt(squared)),scale=f(f(adhesion*tractionLoss)/length);
    forward=f(forward*scale);right=f(right*scale);
  }
  const turnReduction=input.antiDive>0?(braking?f(input.antiDive):driving?f(f(.5)*f(input.antiDive)):0):0;
  return {forward,right,turnForward:f(forward-f(turnReduction*forward)),turnRight:right,state,alreadySkidding,braking,driving,adhesion};
}
