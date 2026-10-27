import {blendBicycleAssociation,newBicycleAssociation,setBicycleAssociationTime,stepBicycleAssociations,BICYCLE_ASSOC_FLAGS,type BicycleAssociation} from './nativeBicycleBlend';
import {controlOrdinaryBikeRider,type OrdinaryBikeRiderState} from './nativeBikeRiderController';
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
 let blended=false;
 let target=identifier===207?pedal:sprint;
 if(!target||target.amount<1&&target.delta<=0){target=blendBicycleAssociation(associations,identifier,duration(identifier));blended=true;}
 if(decision.playing){
  target.flags|=BICYCLE_ASSOC_FLAGS.playing;
  const clock=decision.mode==='sprint'&&pedal?pedal:target;
  clock.flags|=BICYCLE_ASSOC_FLAGS.playing;clock.speed=decision.cadence!;
 }else target.flags&=~BICYCLE_ASSOC_FLAGS.playing;
 const phase=pedal??(identifier===207?target:sprint??target);
 if(blended){
  const left=associations.find(a=>a.identifier===196),right=associations.find(a=>a.identifier===197),forward=associations.find(a=>a.identifier===199);
  const seed=left&&left.amount>.5?.5:right&&right.amount>.5?0:forward&&forward.amount>.5?.75:undefined;
  // The source writes this normalized seed to the crank on the request frame.
  if(seed!==undefined){setBicycleAssociationTime(phase,f(phase.duration*seed));return {decision,fallback:false,crank:seed};}
 }
 return {decision,fallback:false,crank:f(f(f(phase.time*f(-2*Math.PI))/phase.duration)+0)};
}
export interface BmxRiderControlInput extends BicycleRiderInput {
 player:boolean;passenger:boolean;brake:number;fullAnimLean:number;maxReverseVelocity:number;timeStep:number;unclippedTimeStep:number;
}
const crankPhase=(a:BicycleAssociation|undefined)=>a?f(f(f(a.time*f(-2*Math.PI))/a.duration)+0):0;
/** CBmx::ProcessDrivingAnims through 0x10045a134/0x10045a214, before hand placement.
 * Ordinary fallback uses the declared neutral contact/pitch/turn path. */
export function controlBmxRider(associations:BicycleAssociation[],state:OrdinaryBikeRiderState,input:BmxRiderControlInput,duration:(identifier:number)=>number,previousCrank:number){
 const get=(id:number)=>associations.find(a=>a.identifier===id),hop=get(206);
 const blendAngle=(angle:number,target:number,amount:number)=>f(f(f(amount)*f(target))+f(f(1-f(amount))*f(angle)));
 if(hop)return {decision:undefined,crank:blendAngle(previousCrank,Math.PI/2,hop.amount),fallback:false};
 // Snapshot before fallback: newly allocated lean associations affect the crank next frame.
 const pedal=get(207),sprint=get(208),left=get(196),right=get(197),forward=get(199),result=controlBicycleAssociations(associations,input,duration);
 if(result.decision.mode==='ride'){
  if(result.fallback)controlOrdinaryBikeRider(associations,state,input,duration);
  else{state.lean=f(state.lean*f(.95));state.forward=f(state.forward*f(.95));}
  let crank=crankPhase(pedal??sprint);
  if(left&&left.amount>f(.1))crank=blendAngle(crank,Math.PI,left.amount);
  else if(right&&right.amount>f(.1))crank=blendAngle(crank,0,right.amount);
  else if(forward&&forward.amount>f(.1))crank=blendAngle(crank,Math.PI/2,forward.amount);
  else crank=f(crank*f(Math.pow(f(.97),f(input.timeStep))));
  return {...result,crank};
 }
 if(Math.abs(state.lean)>f(.05)||Math.abs(state.forward)>f(.05)){state.lean=f(state.lean*f(.95));state.forward=f(state.forward*f(.95));}
 return result;
}
/** Bicycle rider association owner. Hop time/launch remains owned by NativeBicycleHop. */
export class NativeBicycleRider {
 readonly associations:BicycleAssociation[];
 readonly state:OrdinaryBikeRiderState={lean:0,forward:0};
 decision?:BicycleRiderDecision;crank:number|null=null;
 private hopping=false;
 constructor(private duration:(identifier:number)=>number){const base=newBicycleAssociation(194,duration(194));base.amount=1;this.associations=[base];}
 get baseTime(){return this.associations.find(a=>a.identifier===194)?.time??0;}
 get time(){return (this.associations.find(a=>a.identifier===207)??this.associations.find(a=>a.identifier===208))?.time??0;}
 get fastBlend(){return this.associations.find(a=>a.identifier===208)?.amount;}
 step(dt:number,input:Omit<BmxRiderControlInput,'timeStep'|'unclippedTimeStep'>,hopActive=false,previousCrank=this.crank??0){
  if(hopActive&&!this.hopping){
   // The independently owned partial hop requests BlendAnimation(206, 8).
   // Its unsynchronised time is advanced by the existing hop owner, once.
   const hop=blendBicycleAssociation(this.associations,206,this.duration(206),8);
   this.associations.splice(this.associations.indexOf(hop),1);
  }
  this.hopping=hopActive;this.crank=null;
  if(!hopActive){const timeStep=f(dt*50),result=controlBmxRider(this.associations,this.state,{...input,timeStep,unclippedTimeStep:timeStep},this.duration,previousCrank);this.decision=result.decision;this.crank=result.crank;}
  stepBicycleAssociations(this.associations,dt);
  return this.decision;
 }
}
