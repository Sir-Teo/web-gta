import {requireAsset} from '../assets/binary';
import {stepNativeTransmission,type TransmissionInput,type TransmissionState} from './nativeTransmission';
import type {prepareHandling} from './nativeHandling';
import {nativeVehicleGrip,type NativeVehicleGripInput} from './nativeVehicleGrip';

// Names avoid confusing native FL/RL/FR/RR indices with Rapier FL/FR/RL/RR.
export const NATIVE_CAR_WHEELS=['frontLeft','rearLeft','frontRight','rearRight'] as const;
export type CarWheel=typeof NATIVE_CAR_WHEELS[number];
export type WheelValues=Record<CarWheel,number>;
export const emptyWheelContacts=():WheelValues=>({frontLeft:0,rearLeft:0,frontRight:0,rearRight:0});
function driven(wheel:CarWheel,driveType:string){return driveType==='4'||(wheel.startsWith('front')?driveType==='F':driveType==='R');}

/** Native suspension compression below one refreshes contact retention to four
 * native time units; reaching one decrements retained contact before counting. */
export function stepDriveContacts(previous:WheelValues,compression:WheelValues,driveType:string,timeStep:number){
  requireAsset(['F','R','4'].includes(driveType),'Invalid drive-wheel layout.');
  requireAsset(Number.isFinite(timeStep)&&timeStep>=0&&timeStep<=3,'Invalid wheel contact timestep.');
  const counters=emptyWheelContacts();let count=0,driveCount=0;
  for(const wheel of NATIVE_CAR_WHEELS){
    requireAsset(Number.isFinite(previous[wheel])&&previous[wheel]>=0&&previous[wheel]<=4&&Number.isFinite(compression[wheel]),'Invalid wheel contact state.');
    counters[wheel]=compression[wheel]<1?4:Math.max(0,Math.fround(previous[wheel]-Math.fround(timeStep)));
    if(counters[wheel]>0){count++;if(driven(wheel,driveType))driveCount++;}
  }
  return {counters,count,driveCount};
}

export interface NativeDrivetrainState {contacts:WheelValues;transmission:TransmissionState}
export interface NativeDrivetrainInput extends Omit<TransmissionInput,'hasDriveWheelContact'> {
  compression:WheelValues;
  /** Omit only for the base transmission path without caller grip modifiers. */
  vehicleGrip?:Omit<NativeVehicleGripInput,'tractionMultiplier'|'velocityFrequency'|'acceleration'>;
  /** Caller resolves engine-on and automobile/aircraft eligibility. */
  engineEnabled:boolean;
  /** Original automobile divisor; explicit until its scheduling is reconstructed. */
  velocityFrequency:number;
}

/** Compose contact retention and transmission into eligible per-wheel native
 * thrust. Tire adhesion, brakes, burnout and physical impulses are later stages. */
export function stepNativeDrivetrain(handling:ReturnType<typeof prepareHandling>,previous:NativeDrivetrainState,input:NativeDrivetrainInput){
  requireAsset(Number.isFinite(input.velocityFrequency)&&input.velocityFrequency>0,'Invalid vehicle velocity frequency.');
  const contacts=stepDriveContacts(previous.contacts,input.compression,handling.values.driveType,input.timeStep);
  const transmission=input.engineEnabled?stepNativeTransmission(handling,previous.transmission,{...input,hasDriveWheelContact:contacts.driveCount>0}):
    {state:{...previous.transmission,inertia:previous.transmission.inertia?{...previous.transmission.inertia}:undefined},acceleration:0,shifts:0};
  const transmissionAcceleration=Math.fround(transmission.acceleration/input.velocityFrequency);
  const grip=input.vehicleGrip?nativeVehicleGrip({...input.vehicleGrip,tractionMultiplier:handling.values.tractionMultiplier,velocityFrequency:input.velocityFrequency,acceleration:transmissionAcceleration}):undefined;
  const acceleration=grip?.acceleration??transmissionAcceleration;
  requireAsset(Number.isFinite(acceleration),'Nonfinite wheel thrust.');
  const thrust=emptyWheelContacts();
  for(const wheel of NATIVE_CAR_WHEELS)if(contacts.counters[wheel]>0&&driven(wheel,handling.values.driveType))thrust[wheel]=acceleration;
  return {state:{contacts:contacts.counters,transmission:transmission.state},contactCount:contacts.count,driveContactCount:contacts.driveCount,thrust,acceleration,traction:grip?.traction,shifts:transmission.shifts};
}
