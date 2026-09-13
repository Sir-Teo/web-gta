import type {prepareHandling} from './nativeHandling';
import {requireAsset} from '../assets/binary';

type Handling=ReturnType<typeof prepareHandling>;
export interface TransmissionState {gear:number;inertia?:{ratio:number;smoothing:number}}
export interface TransmissionInput {
  /** Signed native forward velocity, not metres per second. */
  velocity:number;throttle:number;
  /** Native 20 ms units, already subject to the caller's timestep policy. */
  timeStep:number;hasDriveWheelContact:boolean;cheat?:'none'|'perfect'|'nitros';
}
const f=(v:number)=>{const value=Math.fround(v);requireAsset(Number.isFinite(value),'Nonfinite transmission result.');return value;};

/** Source-based drive increment. Pure: caller commits returned state only after
 * successful evaluation. Shift delay is not invented for the unused native argument. */
export function stepNativeTransmission(handling:Handling,previous:TransmissionState,input:TransmissionInput){
  const {values,gears,maxReverseVelocity}=handling;
  requireAsset(Number.isInteger(previous.gear)&&previous.gear>=0&&previous.gear<=values.gears,'Invalid transmission gear.');
  requireAsset(Number.isFinite(input.throttle)&&Math.abs(input.throttle)<=1&&Number.isFinite(input.timeStep)&&input.timeStep>=0&&input.timeStep<=3,'Invalid transmission throttle or timestep.');
  requireAsset(['none','perfect','nitros'].includes(input.cheat??'none'),'Invalid transmission cheat mode.');
  const state:TransmissionState={gear:previous.gear,inertia:previous.inertia?{ratio:f(previous.inertia.ratio),smoothing:f(previous.inertia.smoothing)}:undefined};
  const velocity=f(input.velocity),throttle=f(input.throttle),timeStep=f(input.timeStep);
  let shifts=0,useInertia=!!state.inertia,cheat=input.cheat??'none';
  const done=(acceleration:number)=>({state,acceleration,shifts});
  if(velocity<maxReverseVelocity||velocity>values.maxVelocity)return done(0);
  for(let attempt=0;attempt<=values.gears+1;attempt++){
    const gear=gears[state.gear];requireAsset(!!gear,'Transmission shift exceeded gear storage.');
    let accelerate=false,shiftDown=false;
    if(velocity>gear.changeUpVelocity){
      if(state.gear===0&&throttle<=0)accelerate=true;else state.gear++;
    }else{
      if(velocity>=gear.changeDownVelocity||state.gear===0||state.gear===1&&throttle>=0)accelerate=true;
      shiftDown=true;
    }
    if(accelerate){
      let speedMultiplier=1;
      if(values.gears!==1){
        if(state.gear===0)speedMultiplier=f(4.5);
        else{
          const fraction=f(1-f((state.gear-1)/(values.gears-1))),squared=f(fraction*fraction);
          speedMultiplier=f(f(squared*((values.handlingFlags&1)?5:(values.handlingFlags&2)?4:3))+1);
        }
      }
      const cheatMultiplier=cheat==='perfect'?f(1.2):1,nitrosMultiplier=cheat==='nitros'?2:1;
      let acceleration=f(f(f(f(f(speedMultiplier*f(cheatMultiplier*values.engineAcceleration))*nitrosMultiplier)*f(.4))*throttle)*timeStep);
      if(useInertia){
        const inertia=state.inertia!;
        if(input.hasDriveWheelContact){
          const change=f(f(values.maxVelocity/values.gears)*f(1/3));
          const difference=state.gear===0?f(change-velocity):state.gear===1?f(change+velocity):f(velocity-gear.changeDownVelocity);
          const span=state.gear===0?f(change-gears[0].changeDownVelocity):state.gear===1?f(change+gears[1].changeUpVelocity):f(gear.changeUpVelocity-gear.changeDownVelocity);
          requireAsset(span!==0,'Transmission inertia has a zero velocity span.');
          const ratio=f(difference/span);let delta=f(ratio-inertia.ratio);
          if(cheat==='perfect')delta=f(delta*f(.75));else if(cheat==='nitros')delta=f(delta*f(.5));
          const response=Math.max(f(.1),Math.min(1,f(1-f(delta*values.engineInertia))));
          inertia.ratio=ratio;inertia.smoothing=f(f(response*f(1-f(.85)))+f(f(.85)*inertia.smoothing));
          acceleration=f(acceleration*inertia.smoothing);
        }else{
          requireAsset(values.engineInertia>0,'Airborne transmission requires positive engine inertia.');
          inertia.ratio=Math.min(f(inertia.ratio+f(f(f(Math.abs(throttle)/values.engineInertia)*timeStep)*f(.1))),1);
          inertia.smoothing=f(.1);
        }
      }
      const maximum=f(cheatMultiplier*gear.maxVelocity);
      let excess=0;
      if(gear.maxVelocity>=0||velocity>=maximum){
        if(gear.maxVelocity<=0||velocity<=maximum)return done(acceleration);
        excess=f(velocity-maximum);
      }else excess=f(maximum-velocity);
      return done(f(acceleration*f(1-Math.min(f(excess/f(.05)),1))));
    }
    if(shiftDown)state.gear--;
    shifts++;useInertia=false;cheat='none';
  }
  throw new Error('Transmission shift loop did not converge.');
}
