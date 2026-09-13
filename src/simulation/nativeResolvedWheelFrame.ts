import {nativeTireTemperature} from './nativeTireTemperature';
import {nativeBurnoutMotion,type NativeBurnoutGeometry} from './nativeBurnout';
import {requireAsset} from '../assets/binary';
import type {prepareHandling} from './nativeHandling';
import {stepNativeWheelFrame,type NativeWheelFrameInput,type NativeWheelFrameState} from './nativeWheelFrame';
import {nativeWheelParameters,type WheelParameterInput} from './nativeWheelParameters';
import {nativeTransmissionCheat,nativeVehicleGrip} from './nativeVehicleGrip';

export interface NativeResolvedWheelFrameInput extends Omit<NativeWheelFrameInput,'parameters'|'cheat'|'vehicleGrip'|'rearAxleMotion'> {
  burnoutGeometry?:NativeBurnoutGeometry;
  vehicleGrip:NonNullable<NativeWheelFrameInput['vehicleGrip']>;
  wheelParameters:Omit<WheelParameterInput,'baseTraction'|'timeStep'|'compression'|'playerControlled'|'burnoutTurnResolved'>;
}
/** Resolve one consistent caller context for transmission, acceleration and tire
 * adhesion. Contacts must already reflect suspension and source steering. */
export function stepNativeResolvedWheelFrame(handling:ReturnType<typeof prepareHandling>,previous:NativeWheelFrameState,input:NativeResolvedWheelFrameInput,alreadySkidding:boolean){
  const context=input.vehicleGrip;
  const {traction}=nativeVehicleGrip({...context,tractionMultiplier:handling.values.tractionMultiplier,velocityFrequency:input.velocityFrequency,acceleration:0});
  const cheat=nativeTransmissionCheat(handling.values.handlingFlags,input.wheelParameters.tireTemperature,context.perfectHandling,context.extraPerfectHandling);
  const burnout=input.wheelParameters.burnout&&handling.values.driveType!=='F'&&(!input.wheelParameters.handbrake||(handling.values.handlingFlags&0x40)!==0);
  requireAsset(!burnout||input.burnoutGeometry,'Burnout requires explicit rear-axle turning geometry.');
  const rearAxleMotion=burnout?nativeBurnoutMotion(handling.values.turnMass,input.burnoutGeometry!):undefined;
  const parameters=nativeWheelParameters(handling,{...input.wheelParameters,baseTraction:traction,timeStep:input.timeStep,compression:input.compression,playerControlled:input.playerControlled,burnoutTurnResolved:!!rearAxleMotion});
  const result=stepNativeWheelFrame(handling,previous,{...input,parameters,cheat,rearAxleMotion},alreadySkidding);
  const tireTemperature=nativeTireTemperature(input.wheelParameters.tireTemperature,input.timeStep,handling.values.handlingFlags,handling.values.driveType,input.wheelParameters.burnout,result.state.wheels.rearLeft,result.state.wheels.rearRight);
  return {...result,parameters,cheat,tireTemperature};
}
