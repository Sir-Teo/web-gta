const f=Math.fround;
export interface BicycleRiderInput {
 model:number;
 /** Native forward move speed, in units per 50-Hz frame. */
 speed:number;
 coefficient:number;gear:number;
 /** Prepared cTransmission::m_MaxFlatVelocity (handling +0x88). */
 maxFlatVelocity:number;
 /** CRideAnimData::LeanAngle and LeanFwd. */
 lean:number;leanFwd:number;
 driveBy:boolean;gas:number;status:number;
}
export interface BicycleRiderDecision {mode:'ride'|'pedal'|'sprint';cadence:number|null;playing:boolean}
/** Selected CBmx::ProcessDrivingAnims gate/cadence/playing decision (0x100459cb0).
 * Association requests, blend state and the ordinary CBike rider fallback are separate caller work. */
export function nativeBicycleRiderDecision(input:BicycleRiderInput):BicycleRiderDecision {
 const speed=f(input.speed),coefficient=f(input.coefficient),limit=f(coefficient>5?.7:.4);
 if(Math.abs(f(input.lean))>=limit||input.driveBy||!(speed>f(.01)&&f(input.leanFwd)<limit))return {mode:'ride',cadence:null,playing:false};
 const mountain=input.model===510,gear=input.gear&255;
 const cadence=mountain?(gear?f(f(speed*5)/f(f(f(gear)*f(input.maxFlatVelocity))-.25)):0):f(speed*3);
 const sprint=cadence<(mountain?2:2.5)&&coefficient>5;
 return {mode:sprint?'sprint':'pedal',cadence,playing:sprint||coefficient>0||f(input.gas)!==0||(input.status&31)===2};
}
/** The host's existing unbounded clip clock, now advanced at the captured playback rate.
 * Bunny hop owns the decision while present; the available base clip retains its prior playback.
 * Native animation-manager blending, synchronised associations and float32 phase wrapping remain separate. */
export class NativeBicycleRider {
 time=0;decision?:BicycleRiderDecision;
 step(dt:number,input:BicycleRiderInput,hopActive=false){
  if(!hopActive)this.decision=nativeBicycleRiderDecision(input);
  if(this.decision?.playing&&this.decision.cadence!==null)this.time+=dt*this.decision.cadence;
  return this.decision;
 }
}
