import type RAPIER from '@dimforge/rapier3d-compat';
import type {prepareHandling} from './nativeHandling';
import {requireAsset} from '../assets/binary';
import {initialNativeVehicleState} from './nativeVehicleState';
import {sampleNativeChassis} from './nativeChassis';
import {stepNativeSuspendedWheelFrame,type NativeSuspendedWheelInput} from './nativeSuspendedWheelFrame';
import {applyNativeWheelDeltas} from './nativeWheelMotion';
type Tires=NativeSuspendedWheelInput['tires'];
export interface NativeVehicleForceInput {
  suspension:Omit<NativeSuspendedWheelInput['suspension'],'linear'|'angular'|'centerOfMass'|'mass'|'turnMass'|'direction'>;
  tires:Omit<Tires,'velocity'|'burnoutGeometry'|'wheelParameters'>&{wheelParameters:Omit<Tires['wheelParameters'],'tireTemperature'>};
  steeringControl:Omit<NonNullable<NativeSuspendedWheelInput['steeringControl']>,'right'>;
  fallback:NativeSuspendedWheelInput['fallback'];
}
/** Persistent native wheel-force state for a converted chassis. Ray queries and
 * world integration remain scheduler-owned. Skip step entirely while paused. */
export class NativeVehicleForces {
  private handling:ReturnType<typeof prepareHandling>;
  private wheelFrame=initialNativeVehicleState().wheelFrame;
  private tireTemperature=1;
  constructor(private body:RAPIER.RigidBody,handling:ReturnType<typeof prepareHandling>){
    requireAsset(body.isDynamic(),'Native vehicle forces require a dynamic chassis.');
    this.handling=structuredClone(handling);
  }
  snapshot(){return structuredClone({wheelFrame:this.wheelFrame,tireTemperature:this.tireTemperature});}
  step(input:NativeVehicleForceInput,alreadySkidding:boolean){
    const chassis=sampleNativeChassis(this.body),h=this.handling;
    const result=stepNativeSuspendedWheelFrame(h,this.wheelFrame,{
      suspension:{...input.suspension,...chassis,mass:h.values.mass,turnMass:h.values.turnMass},
      tires:{...input.tires,velocity:chassis.forwardSpeed,wheelParameters:{...input.tires.wheelParameters,tireTemperature:this.tireTemperature}},
      forward:chassis.forward,steeringControl:{...input.steeringControl,right:chassis.right},fallback:input.fallback,
    },alreadySkidding);
    // Prepare owned state before writes. A rejected computation leaves body/history
    // unchanged; callers cannot mutate committed history through returned results.
    const next=structuredClone(result.state),temperature=result.tires.tireTemperature;
    applyNativeWheelDeltas(this.body,result.motions);
    this.wheelFrame=next;this.tireTemperature=temperature;
    return result;
  }
}
