import {bicycleAssociationFlags,blendBicycleAssociation,newBicycleAssociation,stepBicycleAssociations,type BicycleAssociation} from './nativeBicycleBlend';
import {bikeRiderReversePedalling,controlBikeRiderLean,filterBikeRiderLean} from './nativeBikeRiderLean';
const f=Math.fround;
const RIDER_ROLES:Readonly<Record<number,string>>={194:'ride',195:'still',196:'left',197:'right',198:'back',199:'fwd',200:'pushes',206:'bunnyhop',207:'pedal',208:'sprint'};
export interface OrdinaryBikeRiderState {lean:number;forward:number}
/** Ordinary flat/contact-neutral association path. Collision/task reactions and wheelie/stoppie overrides are separate. */
export interface OrdinaryBikeRiderInput {
 speed:number;lean:number;leanFwd:number;player:boolean;passenger:boolean;gas:number;brake:number;
 fullAnimLean:number;maxFlatVelocity:number;maxReverseVelocity:number;timeStep:number;unclippedTimeStep:number;
 quad?:boolean;
}
/** Ride-group slots; QUAD maps Still to Ride and Pushes to Reverse. */
export function bikeRiderClipName(block:string,identifier:number){
 const role=block==='quad'&&identifier===195?'ride':block==='quad'&&identifier===200?'reverse':RIDER_ROLES[identifier];
 if(!role)throw new Error('Unsupported bike rider association.');
 return `${block==='wayfarer'?'wf':block}_${role}`;
}
/** CBike::ProcessRiderAnims through 0x100457f0c, ordinary association/filter stage.
 * Pose node allocation, skeletal vibration and base ride task creation are caller work. */
export function controlOrdinaryBikeRider(associations:BicycleAssociation[],state:OrdinaryBikeRiderState,input:OrdinaryBikeRiderInput,duration:(identifier:number)=>number){
 const get=(id:number)=>associations.find(a=>a.identifier===id),speed=f(input.speed),gas=f(input.gas),reverseVelocity=f(input.maxReverseVelocity);
 let still=get(195),pushes=get(200);const driveBy=get(202)??get(203)??get(204);
 let reverse=false;
 // Quad descriptor table 0x100624c70: Reverse (slot 200) is not looped.
 const ensure=(a:BicycleAssociation|undefined,id:number,blend:number)=>!a||a.amount<1&&a.delta<=0?blendBicycleAssociation(associations,id,duration(id),blend,3,input.quad&&id===200?0x1014:bicycleAssociationFlags(id)):a;
 if(!driveBy&&Math.abs(speed)<f(.02))still=ensure(still,195,2);
 else if(speed<0&&gas<0&&speed>reverseVelocity*1.5)pushes=ensure(pushes,200,4);
 else{
  reverse=bikeRiderReversePedalling(speed,reverseVelocity,input.player);
  for(const a of [still,pushes])if(a&&a.delta>=0)a.delta=-4;
 }
 const predictionTime=f(f(input.unclippedTimeStep)/50),predicted=(a:BicycleAssociation)=>f(a.amount+f(a.delta*predictionTime));
 let available=still?f(1-Math.min(1,predicted(still))):1;
 for(const a of [driveBy,pushes])if(a)available=f(available-Math.min(available,predicted(a)));
 const side=filterBikeRiderLean(state.lean,input.lean,input.fullAnimLean,input.timeStep,reverse);state.lean=side.filtered;
 let forwardTarget=0;
 if(input.player){
  if(!input.passenger){
   if(reverse)forwardTarget=-1;
   else{
    forwardTarget=f(input.leanFwd);
    if(speed>f(.01)&&f(input.brake)>f(.5))forwardTarget=Math.max(forwardTarget,f(.1));
    else if(!(forwardTarget>0)&&gas>f(.5)&&speed<f(f(input.maxFlatVelocity)*f(.3)))forwardTarget=Math.min(forwardTarget,f(-.3));
    if(Math.abs(side.target)>f(.3)){
     const scale=Math.max(0,f(f(f(Math.abs(side.target)+f(-.3))/f(-.26))+1));
     forwardTarget=f(forwardTarget*scale);
    }
   }
  }
  const decay=f(Math.pow(f(.89),f(input.timeStep)));
  state.forward=f(f(forwardTarget*f(1-decay))+f(decay*f(state.forward)));
 }else state.forward=0;
 const addPose=(id:number)=>{if(!get(id)){const a=newBicycleAssociation(id,duration(id));a.amount=1;associations.unshift(a);}};
 if(input.player){addPose(199);addPose(198);}
 addPose(196);addPose(197);
 controlBikeRiderLean(associations,{lean:state.lean,forward:state.forward,available,player:input.player});
 return {reverse,available,sideTarget:side.target,forwardTarget};
}
/** Ordinary ride association owner. Flat/contact-neutral pose inputs are separate from vehicle physics. */
export class NativeBikeRiderController {
 readonly associations:BicycleAssociation[];
 readonly state:OrdinaryBikeRiderState={lean:0,forward:0};
 constructor(private duration:(identifier:number)=>number){const base=newBicycleAssociation(194,duration(194));base.amount=1;this.associations=[base];}
 get filtered(){return this.state.lean;}
 get time(){return this.associations.find(a=>a.identifier===194)?.time??0;}
 step(dt:number,input:Omit<OrdinaryBikeRiderInput,'timeStep'|'unclippedTimeStep'>){
  const timeStep=f(dt*50),result=controlOrdinaryBikeRider(this.associations,this.state,{...input,timeStep,unclippedTimeStep:timeStep},this.duration);
  stepBicycleAssociations(this.associations,dt);return result;
 }
}
