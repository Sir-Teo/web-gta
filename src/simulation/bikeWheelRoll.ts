import {nativeWheelRotationSpeed} from './nativeWheelAnimation';
import type {NativeWheelState} from './nativeWheelResponse';
export interface BikeWheelRoll {rotation:number;speed:number}
/** CBike::PreRender (iOS 0x1004554b4–0x100455600): each axle advances only while one of its suspension
 * contacts is down. The front uses NORMAL; the rear uses its wheel state. Speed is native units/frame. */
export function stepBikeWheelRoll(previous:BikeWheelRoll,state:NativeWheelState,forwardSpeed:number,radius:number,contact:boolean,timeStep:number):BikeWheelRoll{
 if(!contact)return previous;
 const speed=nativeWheelRotationSpeed(state,forwardSpeed,radius);
 return {rotation:Math.fround(Math.fround(previous.rotation)+Math.fround(Math.fround(timeStep)*speed)),speed};
}
