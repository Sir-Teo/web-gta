import {requireAsset} from '../assets/binary';
import type {NativeWheelState} from './nativeWheelResponse';
const f=(n:number)=>{const value=Math.fround(n);requireAsset(Number.isFinite(value),'Nonfinite wheel animation value.');return value;};
/** CVehicle::ProcessWheelRotation. Speed is the projected native velocity,
 * not metres/second; callers integrate using the native 50 Hz timestep. */
export function nativeWheelRotationSpeed(state:NativeWheelState,forwardSpeed:number,radius:number){
 requireAsset(['normal','spinning','skidding','fixed'].includes(state),'Unknown wheel rotation state.');
 const speed=f(forwardSpeed),r=f(radius);requireAsset(r>0,'Wheel rotation needs a positive radius.');
 if(state==='spinning')return f(-1.1);if(state==='fixed')return 0;return f(-f(speed/r));
}
export interface WheelAnimationPose {rotation:number;speed:number;steering:number;height:number}
/** Animation adapter driven by the native contact/steering solution. Wheel matrix
 * construction and contact-frame sampling are not claimed retail PreRender parity. */
export function stepWheelAnimation(previous:WheelAnimationPose,input:{timeStep:number;state:NativeWheelState;forwardSpeed:number;radius:number;contactCount:number;driven:boolean;acceleration:number;steering:number;startHeight:number;springLength:number;compression:number}):WheelAnimationPose{
 const dt=f(input.timeStep);requireAsset(dt>=0&&dt<=3&&input.contactCount>=0&&input.contactCount<=4,'Invalid wheel animation timestep/contact count.');
 let speed=f(previous.speed);const rotation=f(previous.rotation),acceleration=f(input.acceleration);
 if(input.contactCount>0)speed=nativeWheelRotationSpeed(input.state,input.forwardSpeed,input.radius);
 else if(input.driven&&acceleration!==0){
  // ProcessCarWheelPair's airborne branch, including its asymmetric bounds.
  // Once a 30 fps game frame with no timestep: a step takes its share of a frame (timeStep × 30 / 50).
  if(acceleration>0){if(speed<1)speed=f(speed-f(.1*dt*.6));}
  else if(speed>-1)speed=f(speed+f(.05*dt*.6));
 }else speed=f(speed*f(Math.pow(.95,dt*.6)));
 const spring=f(input.springLength),compression=f(input.compression);requireAsset(spring>0&&compression<=1,'Invalid wheel animation suspension.');
 return {rotation:f(rotation+f(dt*speed)),speed,steering:f(input.steering),height:f(f(input.startHeight)-f(spring*compression))};
}
