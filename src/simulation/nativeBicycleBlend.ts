import {requireAsset} from '../assets/binary';
const f=Math.fround;
export const BICYCLE_ASSOC_FLAGS={playing:1,looped:2,autoRemove:4,finishAutoRemove:8,partial:0x10,synced:0x20,facial:0x8000} as const;
/** Native bicycle descriptor table at 0x1006248b0, IDs 194..208. */
const DESCRIPTOR_FLAGS=[4,0x1014,0x1010,0x1010,0x1010,0x1010,0x1016,0x18,0x1014,0x1014,0x1014,4,0x1018,0x1032,0x1032] as const;
export function bicycleAssociationFlags(identifier:number){const flags=DESCRIPTOR_FLAGS[identifier-194];requireAsset(flags!==undefined,'Unsupported bicycle association.');return flags;}
export interface BicycleAssociation {
 identifier:number;group:number;amount:number;delta:number;time:number;speed:number;duration:number;flags:number;timeStep:number;
}
/** Narrow constructor values used by the rider's native animation descriptors. */
export function newBicycleAssociation(identifier:number,duration:number,group=3,descriptorFlags:number=bicycleAssociationFlags(identifier)):BicycleAssociation {
 requireAsset(Number.isFinite(duration)&&duration>0,'Bicycle association needs a positive clip duration.');
 return {identifier,group,timeStep:0,amount:0,delta:0,time:0,speed:1,duration:f(duration),flags:descriptorFlags|1};
}
/** CAnimBlendAssociation::SetCurrentTime (selected iOS 0x100138f50), scalar time portion. */
export function setBicycleAssociationTime(a:BicycleAssociation,time:number){
 a.time=f(time);
 if(a.time>=a.duration){
  if(a.flags&BICYCLE_ASSOC_FLAGS.looped)while(a.time>=a.duration)a.time=f(a.time-a.duration);
  else a.time=a.duration;
 }
}
/** CAnimManager::BlendAnimation, selected iOS 0x10013d5dc. `associations` is clump order, newest first.
 * Allocating pose nodes and decompressing assets are caller work; native scalar blend/sync rules apply here. */
export function blendBicycleAssociation(associations:BicycleAssociation[],identifier:number,duration:number,blend=4,group=3,descriptorFlags:number=bicycleAssociationFlags(identifier)){
 blend=f(blend);const targetFlags=descriptorFlags;let running:BicycleAssociation|undefined,moving:BicycleAssociation|undefined,fades=false;
 for(const a of associations){
  if(targetFlags&BICYCLE_ASSOC_FLAGS.synced&&a.flags&BICYCLE_ASSOC_FLAGS.synced)moving=a;
  if(a.identifier===identifier&&a.group===group)running=a;
  else if((a.flags&BICYCLE_ASSOC_FLAGS.partial)===(targetFlags&BICYCLE_ASSOC_FLAGS.partial)&&(a.flags&BICYCLE_ASSOC_FLAGS.facial)===(targetFlags&BICYCLE_ASSOC_FLAGS.facial)){
   if(a.amount<=0)a.delta=-1;
   else{const delta=f(-a.amount*blend);if(delta<a.delta||!(targetFlags&BICYCLE_ASSOC_FLAGS.partial))a.delta=Math.min(f(-.05),delta);}
   a.flags|=BICYCLE_ASSOC_FLAGS.autoRemove;fades=true;
  }
 }
 if(running){
  running.delta=f(f(1-running.amount)*blend);
  if(running.time===running.duration){running.flags|=BICYCLE_ASSOC_FLAGS.playing;setBicycleAssociationTime(running,0);}
  return running;
 }
 const a=newBicycleAssociation(identifier,duration,group,targetFlags);
 a.flags=targetFlags|BICYCLE_ASSOC_FLAGS.playing;
 if(moving&&a.flags&BICYCLE_ASSOC_FLAGS.synced)setBicycleAssociationTime(a,f(f(moving.time/moving.duration)*a.duration));
 else setBicycleAssociationTime(a,0);
 associations.unshift(a);
 if(fades||targetFlags&BICYCLE_ASSOC_FLAGS.partial){a.amount=0;a.delta=blend;}else a.amount=1;
 return a;
}

/** RpAnimBlendClumpUpdateAnimations (0x10013ad30), scalar blend/shared-phase/time stage.
 * Clip data is nonempty and pose nodes/frame callbacks are owned by the renderer. */
export function stepBicycleAssociations(associations:BicycleAssociation[],dt:number){
 dt=f(dt);if(!associations.length)return {rate:null,removed:[] as number[]};
 let totalPeriod=0,totalBlend=0;const removed:number[]=[];
 for(let i=0;i<associations.length;){
  const a=associations[i];a.amount=f(a.amount+f(a.delta*dt));
  if(a.amount<=0&&a.delta<0){
   a.amount=0;a.delta=0;
   if(a.flags&BICYCLE_ASSOC_FLAGS.autoRemove){removed.push(a.identifier);associations.splice(i,1);continue;}
  }
  if(a.amount>1){a.amount=1;if(a.delta>0)a.delta=0;}
  if(a.flags&BICYCLE_ASSOC_FLAGS.synced){totalPeriod=f(totalPeriod+f(f(a.duration/a.speed)*a.amount));totalBlend=f(totalBlend+a.amount);}
  i++;
 }
 const rate=totalPeriod===0?1:f(totalBlend/totalPeriod);
 for(const a of associations)if(a.flags&BICYCLE_ASSOC_FLAGS.playing){
  const speed=a.flags&BICYCLE_ASSOC_FLAGS.synced?(totalPeriod===0?a.duration:f(rate*a.duration)):a.speed;
  a.timeStep=f(speed*dt);
 }
 for(const a of associations){
  if(!(a.flags&BICYCLE_ASSOC_FLAGS.playing))continue;
  if(a.time>=a.duration){a.flags&=~BICYCLE_ASSOC_FLAGS.playing;continue;}
  a.time=f(a.time+a.timeStep);
  if(Number.isNaN(a.time)||a.time<a.duration)continue;
  if(a.flags&BICYCLE_ASSOC_FLAGS.looped)a.time=f(a.time-a.duration);
  else{a.time=a.duration;if(a.flags&BICYCLE_ASSOC_FLAGS.finishAutoRemove){a.flags|=BICYCLE_ASSOC_FLAGS.autoRemove;a.delta=-4;}}
 }
 return {rate,removed};
}
