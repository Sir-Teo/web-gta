import {requireAsset} from '../assets/binary';
import type {prepareHandling} from './nativeHandling';
import {NATIVE_CAR_WHEELS,type CarWheel,type WheelValues} from './nativeDriveContacts';
import type {NativeWheelFrameInput} from './nativeWheelFrame';

export interface WheelSurfaceInput {adhesiveLimit:number;wetMultiplier:number;offRoad:boolean;burst:boolean;burstNoise?:number}
export interface WheelParameterInput {
  /** Caller-resolved vehicle/status traction, before wheel-pair modifiers. */
  baseTraction:number;brakePedal:number;timeStep:number;coastBrake:number;
  compression:WheelValues;surfaces:Record<CarWheel,WheelSurfaceInput>;
  handbrake:boolean;burnout:boolean;tireTemperature:number;wheelDamageEffect:number;
  /** Player/remote-control status and TreatAsPlayerForCollisions are distinct. */
  playerControlled:boolean;playerCollisions:boolean;
}
const f=(value:number)=>{const result=Math.fround(value);requireAsset(Number.isFinite(result),'Nonfinite wheel parameter.');return result;};

/** Resolve ordinary automobile wheel-pair brake and adhesion modifiers in source
 * order. Burnout's extra turning force is rejected until it can be applied too. */
export function nativeWheelParameters(handling:ReturnType<typeof prepareHandling>,input:WheelParameterInput):NativeWheelFrameInput['parameters']{
  const h=handling.values,flags=h.handlingFlags;
  for(const v of [input.baseTraction,input.coastBrake,input.wheelDamageEffect,h.suspensionForce])requireAsset(Number.isFinite(v)&&v>=0,'Invalid nonnegative wheel parameter.');
  for(const v of [input.brakePedal,h.brakeBias,h.tractionBias,h.suspensionBias])requireAsset(Number.isFinite(v)&&v>=0&&v<=1,'Invalid wheel pedal or axle bias.');
  requireAsset(Number.isFinite(input.timeStep)&&input.timeStep>=0&&input.timeStep<=3&&Number.isFinite(input.tireTemperature),'Invalid wheel timestep or tire temperature.');
  const baseBrake=f(f(h.brakeDeceleration*f(input.brakePedal))*f(input.timeStep));
  const rearDrive=h.driveType!=='F',rearHandbrake=input.handbrake&&(flags&0x40)===0;
  requireAsset(!(rearDrive&&input.burnout&&!rearHandbrake),'Burnout requires its additional turning-force path.');
  const neutral=!input.playerControlled&&(flags&8)!==0;
  const result={} as NativeWheelFrameInput['parameters'];
  for(const wheel of NATIVE_CAR_WHEELS){
    const front=wheel.startsWith('front'),surface=input.surfaces[wheel],compression=input.compression[wheel];
    requireAsset(surface&&Number.isFinite(surface.adhesiveLimit)&&surface.adhesiveLimit>=0&&Number.isFinite(surface.wetMultiplier)&&surface.wetMultiplier>=0,'Invalid wheel surface parameters.');
    requireAsset(Number.isFinite(compression)&&compression<=1,'Invalid native suspension compression.');
    const bias=(value:number)=>front?f(2*f(value)):f(2-f(2*f(value)));
    const brakeBias=neutral?1:bias(h.brakeBias),tractionBias=neutral?1:bias(h.tractionBias),suspensionBias=bias(h.suspensionBias);
    let traction=f(input.baseTraction),brake=baseBrake;
    if(!front){
      if(rearHandbrake)brake=20000;
      else if(rearDrive&&(flags&0x80000)===0)traction=f(traction*f(input.tireTemperature));
    }
    let adhesion=f(f(surface.adhesiveLimit)*traction);
    if(input.playerCollisions){
      adhesion=f(adhesion*f(surface.wetMultiplier));
      const load=Math.min(f(f(f(suspensionBias*h.suspensionForce)*4)*f(1-f(compression))),2);
      adhesion=f(adhesion*load);
      if(surface.offRoad){if((flags&0x200000)!==0)adhesion=f(adhesion*f(1.4));else if((flags&0x100000)!==0)adhesion=f(adhesion*f(1.15));}
    }
    if(surface.burst)adhesion=f(adhesion*f(input.wheelDamageEffect));
    adhesion=f(adhesion*tractionBias);requireAsset(adhesion>=0,'Unsupported negative wheel adhesion.');
    result[wheel]={brake:f(brake*brakeBias),coastBrake:f(input.coastBrake),adhesion,burst:surface.burst,burstNoise:surface.burstNoise};
  }
  return result;
}
