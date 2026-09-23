import {nativePedals,type NativePedalInput} from './nativePedals';
import {stepNativeSteeringInput,type NativeSteeringControl,type NativeSteeringState} from './nativeSteeringInput';
import {nativeAirResistance,nativeCarAirResistance} from './nativeAirResistance';
import {nativeGravity,type NativeGravityFlags} from './nativeGravity';
import type RAPIER from '@dimforge/rapier3d-compat';
import type {prepareHandling} from './nativeHandling';
import {requireAsset} from '../assets/binary';
import {initialNativeVehicleState} from './nativeVehicleState';
import {sampleNativeChassis} from './nativeChassis';
import {stepNativeSuspendedWheelFrame,type NativeSuspendedWheelInput} from './nativeSuspendedWheelFrame';
import {applyNativeWheelDeltas} from './nativeWheelMotion';
type Tires=NativeSuspendedWheelInput['tires'];
export interface NativeVehicleForceInput {
  /** Explicit ownership: when supplied, Rapier gravity must be disabled. */
  gravity?:NativeGravityFlags;
  airResistance?:{extraMultiplier?:number};
  suspension:Omit<NativeSuspendedWheelInput['suspension'],'linear'|'angular'|'centerOfMass'|'mass'|'turnMass'|'direction'>;
  tires:Omit<Tires,'velocity'|'burnoutGeometry'|'wheelParameters'>&{wheelParameters:Omit<Tires['wheelParameters'],'tireTemperature'>};
  steeringControl:Omit<NonNullable<NativeSuspendedWheelInput['steeringControl']>,'right'>;
  fallback:NativeSuspendedWheelInput['fallback'];
}
export interface NativeVehiclePlayerInput extends Omit<NativeVehicleForceInput,'tires'|'steeringControl'> {
  tires:Omit<NativeVehicleForceInput['tires'],'throttle'|'engineEnabled'|'wheelParameters'>&{wheelParameters:Omit<NativeVehicleForceInput['tires']['wheelParameters'],'brakePedal'|'handbrake'|'burnout'>};
  steeringControl:Omit<NativeVehicleForceInput['steeringControl'],'angle'|'secondAngle'>;
  pedals:Omit<NativePedalInput,'forwardSpeed'|'previousGas'>;
  steering:Omit<NativeSteeringControl,'timeStep'|'steeringLockDegrees'|'rearHandbrakeSteering'|'handbrake'>;
  /** A driver the game controls: CCarCtrl::SteerAICarWithPhysics writes m_fSteerAngle (radians, positive left),
   * the gas pedal (negative reverses), the brake pedal and the handbrake directly, bypassing the player's
   * ProcessControlInputs. The pedal and steering fields above are then ignored. */
  ai?:{steerAngle:number;gas:number;brake:number;handbrake:boolean};
}
/** Persistent native wheel-force state for a converted chassis. Ray queries and
 * world integration remain scheduler-owned. Skip step entirely while paused. */
export class NativeVehicleForces {
  private handling:ReturnType<typeof prepareHandling>;
  private wheelFrame=initialNativeVehicleState().wheelFrame;
  private tireTemperature=1;
  private previousGas=0;
  // Adapter initialization for input-device state, not a claimed retail constructor.
  private steering:NativeSteeringState={raw:0,secondAngle:0,lastInput:'keyboard'};
  constructor(private body:RAPIER.RigidBody,handling:ReturnType<typeof prepareHandling>){
    requireAsset(body.isDynamic(),'Native vehicle forces require a dynamic chassis.');
    this.handling=structuredClone(handling);
  }
  snapshot(){return structuredClone({wheelFrame:this.wheelFrame,tireTemperature:this.tireTemperature,previousGas:this.previousGas,steering:this.steering,nitroBoosts:this.nitroBoosts});}
  /** CAutomobile::m_nNitroBoosts; 101 or more is endless. */
  nitroBoosts=0;
  /** handlingFlags.bNosInst (0x80000). */
  get nitroInstalled(){return (this.handling.values.handlingFlags&0x80000)!==0;}
  /** CAutomobile::NitrousControl (0x6A3EA0). A positive `boost` fits nitro with that many shots, a negative one takes it
   * off, and 0 runs it for a frame: a full tank (m_fTireTemperature at exactly 1) fires on the car-gun button (a
   * physics-driven car fires on its own), unless the driver is looking about; it burns for 1000 time steps, then
   * refills by max(0.25, 1 - gas) / 100 a step, and the fitting goes with the last shot. `pad` is the player's pad
   * when he drives, and `physics` is STATUS_PHYSICS. */
  nitrousControl(boost:number,timeStep:number,gas:number,pad:{fire:boolean;looking:boolean}|undefined,physics:boolean){
   const flags=this.handling.values;
   if(boost>0){flags.handlingFlags|=0x80000;this.tireTemperature=1;this.nitroBoosts=boost;return;}
   if(boost<0){flags.handlingFlags&=~0x80000;this.tireTemperature=1;this.nitroBoosts=0;return;}
   if(this.tireTemperature===1&&this.nitroBoosts>0){
    if(!physics&&(!pad||!pad.fire||pad.looking))return;
    this.tireTemperature=Math.fround(-.000001);
    if(this.nitroBoosts<101)this.nitroBoosts--;
    return;
   }
   if(this.tireTemperature>=0){this.tireTemperature=Math.fround(Math.min(1,Math.max(.25,1-gas)*(timeStep/100)+this.tireTemperature));return;}
   this.tireTemperature=Math.fround(this.tireTemperature-timeStep/1000);
   if(this.tireTemperature< -1){
    this.tireTemperature=Math.fround(.000001);
    if(!this.nitroBoosts){flags.handlingFlags&=~0x80000;this.tireTemperature=1;}
   }
  }
  /** CAutomobile::ProcessControl under the all-cars-nitro cheat: bNosInst set and m_nNitroBoosts at 101, the tank as
   * it is. */
  fitEndlessNitro(){this.handling.values.handlingFlags|=0x80000;this.nitroBoosts=101;}
  /** Whether the nitro is burning (a negative m_fTireTemperature with it fitted). */
  get nitroBurning(){return this.nitroInstalled&&this.tireTemperature<0;}
  stepPlayer(input:NativeVehiclePlayerInput,alreadySkidding:boolean){
    const ai=input.ai;
    const pedals=ai?{gas:Math.fround(Math.max(-1,Math.min(1,ai.gas))),brake:Math.fround(Math.max(0,Math.min(1,ai.brake))),burnout:false,handbrake:ai.handbrake}
      :nativePedals({...input.pedals,forwardSpeed:sampleNativeChassis(this.body).forwardSpeed,previousGas:this.previousGas});
    const steering=ai?{state:{...this.steering,secondAngle:0},angle:Math.fround(ai.steerAngle)}:stepNativeSteeringInput(this.steering,{...input.steering,timeStep:input.suspension.timeStep,
      steeringLockDegrees:this.handling.values.steeringLock,rearHandbrakeSteering:(this.handling.values.handlingFlags&0x40)!==0,handbrake:pedals.handbrake});
    const result=this.step({...input,steeringControl:{...input.steeringControl,angle:steering.angle,secondAngle:steering.state.secondAngle},
      tires:{...input.tires,throttle:pedals.gas,engineEnabled:input.pedals.engineOn,wheelParameters:{...input.tires.wheelParameters,brakePedal:pedals.brake,handbrake:pedals.handbrake,burnout:pedals.burnout}}},alreadySkidding);
    this.steering={...steering.state};
    return {...result,pedals,steeringInput:steering};
  }
  step(input:NativeVehicleForceInput,alreadySkidding:boolean){
    const chassis=sampleNativeChassis(this.body),h=this.handling;
    requireAsset(!input.gravity||this.body.gravityScale()===0,'Disable Rapier chassis gravity before applying native gravity.');
    const gravity=input.gravity?nativeGravity(input.suspension.timeStep,input.gravity):undefined;
    let linear=gravity?{...chassis.linear,z:Math.fround(chassis.linear.z+gravity.linear.z)}:chassis.linear;
    requireAsset(!input.airResistance||(this.body.linearDamping()===0&&this.body.angularDamping()===0),'Disable Rapier chassis damping before applying native air resistance.');
    const air=input.airResistance?nativeAirResistance(linear,chassis.angular,input.suspension.timeStep,nativeCarAirResistance(h.values.dragMultiplier),input.airResistance.extraMultiplier):undefined;
    if(air)linear=air.linear;
    const result=stepNativeSuspendedWheelFrame(h,this.wheelFrame,{
      suspension:{...input.suspension,...chassis,linear,angular:air?.angular??chassis.angular,mass:h.values.mass,turnMass:h.values.turnMass},
      tires:{...input.tires,wheelParameters:{...input.tires.wheelParameters,tireTemperature:this.tireTemperature}},
      forward:chassis.forward,steeringControl:{...input.steeringControl,right:chassis.right},fallback:input.fallback,
    },alreadySkidding);
    // Prepare owned state before writes. A rejected computation leaves body/history
    // unchanged; callers cannot mutate committed history through returned results.
    const next=structuredClone(result.state),temperature=result.tires.tireTemperature;
    const motions=[...(gravity?[gravity]:[]),...(air?[air.delta]:[]),...result.motions];
    applyNativeWheelDeltas(this.body,motions);
    this.wheelFrame=next;this.tireTemperature=temperature;this.previousGas=input.tires.throttle;
    return {...result,motions};
  }
}
