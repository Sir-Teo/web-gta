import {BICYCLE_ASSOC_FLAGS,newBicycleAssociation,stepBicycleAssociations,type BicycleAssociation} from './nativeBicycleBlend';
const f=Math.fround;
export interface BikeRiderLeanInput {lean:number;forward:number;available:number;player:boolean}
/** Ordinary reverse-pedalling sentinel at 0x100457b80; comparison is promoted to double after float field reads. */
export function bikeRiderReversePedalling(speed:number,maxReverseVelocity:number,player:boolean){return player&&f(speed)<f(maxReverseVelocity)*1.5;}
/** Selected 0x100457c8c normalization/filter; native imported powf is represented by rounded Math.pow. */
export function filterBikeRiderLean(previous:number,lean:number,fullAnimLean:number,timeStep:number,reverse=false){
 const target=Math.max(-1,Math.min(1,reverse?0:f(f(lean)/f(fullAnimLean)))),decay=f(Math.pow(f(.86),f(timeStep)));
 return {target,decay,filtered:f(f(target*f(1-decay))+f(decay*f(previous)))};
}
/** CBike::ProcessRiderAnims 0x100457d58..0x100457f0c. Filtered lean and
 * available partial blend are caller inputs; association creation is separate. */
export function controlBikeRiderLean(associations:readonly BicycleAssociation[],input:BikeRiderLeanInput){
 const lean=f(input.lean),forward=f(input.forward),available=f(input.available);
 let sideWeight=1,forwardWeight=0;
 if(Math.abs(lean)<=f(.56)&&input.player){
  if(Math.abs(forward)>f(.56)){sideWeight=0;forwardWeight=1;}
  else{
   sideWeight=Math.abs(lean);forwardWeight=Math.abs(forward);
   const length=f(Math.sqrt(f(f(forward*forward)+f(lean*lean))));
   if(length>f(.01)){forwardWeight=Math.abs(f(forward/length));sideWeight=Math.abs(f(lean/length));}
  }
 }
 const pose=(value:number,weight:number,negative:number,positive:number)=>{
  const chosen=associations.find(a=>a.identifier===(value<0?negative:positive)),other=associations.find(a=>a.identifier===(value<0?positive:negative));
  if(chosen){chosen.amount=f(available*weight);chosen.time=Math.min(chosen.duration,f(chosen.duration*Math.abs(value)));chosen.flags&=~BICYCLE_ASSOC_FLAGS.playing;}
  if(other)other.amount=0;
 };
 if(input.player)pose(forward,forwardWeight,198,199);
 pose(lean,sideWeight,196,197);
}
/** Owns the selected lean pose stage; base ride/still choice and physical body lean remain caller work. */
export class NativeBikeRiderLean {
 readonly associations:BicycleAssociation[];
 filtered=0;
 constructor(duration:(identifier:number)=>number){this.associations=[196,197,198,199].map(id=>newBicycleAssociation(id,duration(id)));}
 step(dt:number,lean:number,fullAnimLean:number,player:boolean,available:number,reverse=false){
  this.filtered=filterBikeRiderLean(this.filtered,lean,fullAnimLean,f(dt*50),reverse).filtered;
  controlBikeRiderLean(this.associations,{lean:this.filtered,forward:0,player,available});
  stepBicycleAssociations(this.associations,dt);
 }
}
