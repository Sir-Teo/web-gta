import type {prepareHandling} from './nativeHandling';
import {stepNativeWheelFrame,type NativeWheelFrameInput,type NativeWheelFrameState} from './nativeWheelFrame';
import {nativeWheelParameters,type WheelParameterInput} from './nativeWheelParameters';
import {nativeTransmissionCheat,nativeVehicleGrip} from './nativeVehicleGrip';

export interface NativeResolvedWheelFrameInput extends Omit<NativeWheelFrameInput,'parameters'|'cheat'|'vehicleGrip'> {
  vehicleGrip:NonNullable<NativeWheelFrameInput['vehicleGrip']>;
  wheelParameters:Omit<WheelParameterInput,'baseTraction'|'timeStep'|'compression'|'playerControlled'>;
}
/** Resolve one consistent caller context for transmission, acceleration and tire
 * adhesion. Contacts must already reflect suspension and source steering. */
export function stepNativeResolvedWheelFrame(handling:ReturnType<typeof prepareHandling>,previous:NativeWheelFrameState,input:NativeResolvedWheelFrameInput,alreadySkidding:boolean){
  const context=input.vehicleGrip;
  const {traction}=nativeVehicleGrip({...context,tractionMultiplier:handling.values.tractionMultiplier,velocityFrequency:input.velocityFrequency,acceleration:0});
  const cheat=nativeTransmissionCheat(handling.values.handlingFlags,input.wheelParameters.tireTemperature,context.perfectHandling,context.extraPerfectHandling);
  const parameters=nativeWheelParameters(handling,{...input.wheelParameters,baseTraction:traction,timeStep:input.timeStep,compression:input.compression,playerControlled:input.playerControlled});
  const result=stepNativeWheelFrame(handling,previous,{...input,parameters,cheat},alreadySkidding);
  return {...result,parameters,cheat};
}
