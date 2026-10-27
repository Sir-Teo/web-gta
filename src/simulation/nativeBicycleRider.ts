import {blendBicycleAssociation,stepBicycleAssociations,BICYCLE_ASSOC_FLAGS,type BicycleAssociation} from './nativeBicycleBlend';
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
/** Selected CBmx association writes, with ordinary CBike fallback and lean pose nodes owned by the caller.
 * Durations are loaded IFP durations; associations are in native newest-first order. */
export function controlBicycleAssociations(associations:BicycleAssociation[],input:BicycleRiderInput,duration:(identifier:number)=>number){
 const decision=nativeBicycleRiderDecision(input),pedal=associations.find(a=>a.identifier===207),sprint=associations.find(a=>a.identifier===208);
 if(decision.mode==='ride'){
  const active=[pedal,sprint].some(a=>a&&a.delta>=0&&a.amount>0);
  if(active)for(const a of [pedal,sprint])if(a){a.delta=-8;a.flags&=~BICYCLE_ASSOC_FLAGS.playing;}
  return {decision,fallback:!active,crank:null};
 }
 const identifier=decision.mode==='sprint'?208:207;
 let target=identifier===207?pedal:sprint;
 if(!target||target.amount<1&&target.delta<=0)target=blendBicycleAssociation(associations,identifier,duration(identifier));
 if(decision.playing){
  target.flags|=BICYCLE_ASSOC_FLAGS.playing;
  const clock=decision.mode==='sprint'&&pedal?pedal:target;
  clock.flags|=BICYCLE_ASSOC_FLAGS.playing;clock.speed=decision.cadence!;
 }else target.flags&=~BICYCLE_ASSOC_FLAGS.playing;
 const phase=pedal??(identifier===207?target:sprint??target);
 return {decision,fallback:false,crank:f(f(f(phase.time*f(-2*Math.PI))/phase.duration)+0)};
}
/** Bicycle pedal/sprint association owner. Hop time/launch remains owned by NativeBicycleHop. */
export class NativeBicycleRider {
 readonly associations:BicycleAssociation[]=[];
 decision?:BicycleRiderDecision;crank:number|null=null;
 private hopping=false;
 constructor(private duration:(identifier:number)=>number){}
 get time(){return (this.associations.find(a=>a.identifier===207)??this.associations.find(a=>a.identifier===208))?.time??0;}
 get fastBlend(){return this.associations.find(a=>a.identifier===208)?.amount;}
 step(dt:number,input:BicycleRiderInput,hopActive=false){
  if(hopActive&&!this.hopping){
   // The independently owned partial hop requests BlendAnimation(206, 8).
   // Its unsynchronised time is advanced by the existing hop owner, once.
   const hop=blendBicycleAssociation(this.associations,206,this.duration(206),8);
   this.associations.splice(this.associations.indexOf(hop),1);
  }
  this.hopping=hopActive;this.crank=null;
  if(!hopActive){const result=controlBicycleAssociations(this.associations,input,this.duration);this.decision=result.decision;this.crank=result.crank;}
  stepBicycleAssociations(this.associations,dt);
  return this.decision;
 }
}
