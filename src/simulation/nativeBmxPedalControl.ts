import {SPRINT_MODE,controlNativeSprint,handleNativeSprintEnergy,nativeButtonSprintResult,type NativeSprintState} from './nativePlayerSprint';
const f=Math.fround;
export interface BmxPedalState extends NativeSprintState {steer:number;gas:number;brake:number;boost:boolean;coefficient:number}
export interface BmxPedalInput {
 accelerate:number;acceleratePressed:boolean;held:boolean;justPressed:boolean;capacity:number;
 fastBlend?:number;neverTired?:boolean;adrenaline?:boolean;sprintDisabled?:boolean;
}
/** Selected CBmx player decision block 0x100459478..0x100459558, including its 0x1004597c0 continuations.
 * Native bike control clears bPlayerBoost before this block; a supplied existing bit remains set.
 * Pad and actual BIKE_SPRINT association blend are caller inputs. */
export function stepBmxPedalControl(state:BmxPedalState,input:BmxPedalInput,timeStep:number){
 state.steer=f(state.steer);state.gas=f(state.gas);state.brake=f(state.brake);state.coefficient=f(state.coefficient);
 if(Math.abs(state.steer)<f(.0001))state.steer=0;
 const factor=controlNativeSprint(state,SPRINT_MODE.bmx,{held:input.held,justPressed:input.justPressed,moving:false,inVehicle:true,neverTired:input.neverTired,adrenaline:input.adrenaline,sprintDisabled:input.sprintDisabled},timeStep);
 const button=nativeButtonSprintResult(state.buttonSpeed,SPRINT_MODE.bmx);
 if(factor>f(1.2)||input.fastBlend!==undefined&&button>1&&f(input.fastBlend)>.5){state.boost=true;state.coefficient=f(state.buttonSpeed);}
 else if(input.accelerate!==0&&state.steer===0){state.boost=true;state.coefficient=f(5.0001);}
 else{
  // Native constant 0x100593c20 is -255: accelerator input halves recovery at full pressure.
  const recovery=Math.max(.5,f(1+f(f(f(input.accelerate)/-255)*.5)));
  handleNativeSprintEnergy(state,false,recovery,timeStep,input.capacity,!!input.neverTired,!!input.adrenaline);
  if(button>0){state.coefficient=f(4.9);if(state.gas===0&&state.brake===0)state.gas=1;}
  else if(state.energy>=0)state.coefficient=0;
  else if(input.acceleratePressed)state.coefficient=f(4.9);
  else state.coefficient=Math.max(0,f(state.coefficient+f(-.4)));
 }
 return state.boost;
}
