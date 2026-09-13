import {requireAsset} from '../assets/binary';
import type {prepareHandling} from './nativeHandling';
import {stepNativeDrivetrain,type CarWheel,type NativeDrivetrainInput,type NativeDrivetrainState} from './nativeDriveContacts';
import {nativeWheelResponse,type NativeWheelState,type NativeWheelInput} from './nativeWheelResponse';
import {nativeWheelVelocityDelta,type WheelMotionInput} from './nativeWheelMotion';

export interface NativeWheelFrameState {drivetrain:NativeDrivetrainState;wheels:Record<CarWheel,NativeWheelState>}
export type WheelFrameContact=Pick<WheelMotionInput,'forward'|'right'|'point'|'centerOfMass'>&{forwardSpeed:number;rightSpeed:number};
export interface NativeWheelFrameInput extends NativeDrivetrainInput {
  /** Snapshot all speeds before applying any wheel motion. Retained airborne
   * contacts need caller-resolved native fallback geometry, not stale ray hits. */
  contacts:Record<CarWheel,WheelFrameContact|undefined>;
  parameters:Record<CarWheel,Pick<NativeWheelInput,'brake'|'coastBrake'|'adhesion'|'burst'|'burstNoise'>>;
  playerControlled:boolean;
}

/** Base four-wheel composition. Surface, axle bias and special wheel-pair
 * modifiers must already be resolved in parameters. Shared skid history is
 * explicit across calls/vehicles; this function does not choose its lifetime. */
export function stepNativeWheelFrame(handling:ReturnType<typeof prepareHandling>,previous:NativeWheelFrameState,input:NativeWheelFrameInput,alreadySkidding:boolean){
  const drivetrain=stepNativeDrivetrain(handling,previous.drivetrain,input),wheels={...previous.wheels};
  const front:CarWheel[]=['frontLeft','frontRight'],rear:CarWheel[]=['rearLeft','rearRight'];
  const order=(handling.values.handlingFlags&0x00800000)!==0?[...rear,...front]:[...front,...rear];
  const responses:Partial<Record<CarWheel,ReturnType<typeof nativeWheelResponse>>>={},motions:ReturnType<typeof nativeWheelVelocityDelta>[]=[];
  for(const wheel of order){
    if(drivetrain.state.contacts[wheel]===0)continue;
    const contact=input.contacts[wheel];requireAsset(contact,`Missing current or fallback contact for ${wheel}.`);
    const response=nativeWheelResponse({...input.parameters[wheel],wheel,previousState:wheels[wheel],alreadySkidding,
      forwardSpeed:contact.forwardSpeed,rightSpeed:contact.rightSpeed,contactCount:drivetrain.contactCount,thrust:drivetrain.thrust[wheel],
      tractionLoss:handling.values.tractionLoss,throttle:input.throttle,timeStep:input.timeStep,playerControlled:input.playerControlled,antiDive:handling.values.suspensionAntiDive});
    alreadySkidding=response.alreadySkidding;responses[wheel]=response;
    const drive=handling.values.driveType==='4'||(wheel.startsWith('front')?handling.values.driveType==='F':handling.values.driveType==='R');
    // Wheel-pair code suppresses the spinning state under reverse drive.
    wheels[wheel]=drive&&input.throttle<0&&response.state==='spinning'?'normal':response.state;
    if(response.forward!==0||response.right!==0)motions.push(nativeWheelVelocityDelta({...contact,response,mass:handling.values.mass,turnMass:handling.values.turnMass}));
  }
  return {state:{drivetrain:drivetrain.state,wheels},alreadySkidding,responses,motions,order,contactCount:drivetrain.contactCount,driveContactCount:drivetrain.driveContactCount};
}
