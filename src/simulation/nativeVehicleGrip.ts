import {requireAsset} from '../assets/binary';
const f=(n:number)=>{const r=Math.fround(n);requireAsset(Number.isFinite(r),'Nonfinite vehicle grip.');return r;};
export interface NativeVehicleGripInput {
  tractionMultiplier:number;velocityFrequency:number;physicsStatus:boolean;
  /** Required in STATUS_PHYSICS only; distinct from handling traction multiplier. */
  carTraction?:number;
  /** Transmission increment after division by velocity frequency. */
  acceleration:number;
  perfectHandling:boolean;extraPerfectHandling:boolean;extraHandlingNitros:boolean;
  isPlayerVehicle:boolean;vortex:boolean;vortexAccelerationBrakeStatus:number;
}
/** Automobile caller modifiers before steering and wheel-pair processing. */
export function nativeVehicleGrip(input:NativeVehicleGripInput){
  const multiplier=f(input.tractionMultiplier),frequency=f(input.velocityFrequency);
  let acceleration=f(input.acceleration);
  requireAsset(multiplier>=0&&frequency>0,'Invalid vehicle traction or velocity frequency.');
  let traction=f(f(.004)*multiplier);
  if(input.physicsStatus){
    requireAsset(input.carTraction!==undefined,'Physics-status vehicle requires car traction.');
    const carTraction=f(input.carTraction);requireAsset(carTraction>=0,'Car traction must be nonnegative.');
    // Preserve the pre-refactor source expression. Commit 5f93be88 replaced
    // multiplication by .004 with a non-equivalent reciprocal expression.
    traction=f(f(f(.004)*carTraction)*multiplier);
  }
  traction=f(traction*f(.25/frequency));
  if(input.perfectHandling||input.vortex&&f(input.vortexAccelerationBrakeStatus)===0)traction=f(traction*4);
  if(!input.isPlayerVehicle&&(input.extraPerfectHandling||input.perfectHandling)){
    traction=f(traction*f(1.2));acceleration=f(acceleration*f(1.4));
    if(input.extraHandlingNitros||input.perfectHandling){traction=f(traction*f(1.3));acceleration=f(acceleration*f(1.4));}
  }
  return {traction,acceleration};
}
/** NOS has precedence over perfect handling in the transmission caller, while
 * grip modifiers still use the separate flags above. */
export function nativeTransmissionCheat(handlingFlags:number,tireTemperature:number,perfectHandling:boolean,extraPerfectHandling:boolean):'none'|'nitros'|'perfect'{
  requireAsset(Number.isInteger(handlingFlags)&&handlingFlags>=0&&handlingFlags<=0xffffffff,'Invalid handling flags.');
  const temperature=f(tireTemperature);
  return (handlingFlags&0x80000)!==0&&temperature<0?'nitros':perfectHandling||extraPerfectHandling?'perfect':'none';
}
