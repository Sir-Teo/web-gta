import {PED_ATTRACTOR} from '../assets/twoDEffect';

/** CPedAttractor (gta-reversed ead3051): a placed 2dfx ped attractor with its queue. ATMs and bus stops take five
 * peds, everything else one; slot `i` stands `spacing` units back along the queue direction (with a random jitter
 * of ±deltaPos on the plane and ±deltaHeading on the heading for the peds behind the head), the head faces the
 * use direction and the others the queue direction. When a ped leaves, those behind shuffle one slot up, each
 * after 2 s per slot (BroadcastDeparture). */
export interface AttractorParams {maxPeds:number;spacing:number;arriveRange:number;deltaPos:number;deltaHeading:number}
export function attractorParams(type:number):AttractorParams{
 switch(type){
  case PED_ATTRACTOR.atm:return {maxPeds:5,spacing:1,arriveRange:0.2,deltaPos:0.1,deltaHeading:0.1};
  case PED_ATTRACTOR.stop:return {maxPeds:5,spacing:1,arriveRange:0.2,deltaPos:0.1,deltaHeading:0.1};
  case PED_ATTRACTOR.seat:return {maxPeds:1,spacing:1,arriveRange:0.125,deltaPos:0.1,deltaHeading:0.1};
  default:return {maxPeds:1,spacing:1,arriveRange:0.2,deltaPos:0.1,deltaHeading:0.1};
 }
}
export interface AttractorEffect {
 key:string;type:number;
 /** Native world space: position and unit directions (CPedAttractorManager::ComputeEffect*). */
 position:readonly [number,number,number];queueDir:readonly [number,number,number];useDir:readonly [number,number,number];forwardDir:readonly [number,number,number];
}
/** CGeneral::GetRadianAngleBetweenPoints(dir.x, dir.y, 0, 0) as the browser heading (0 faces +z, i.e. native -y). */
export function attractorHeading(dir:readonly [number,number,number]){return Math.atan2(dir[0],-dir[1]);}
export class AttractorQueue {
 readonly params:AttractorParams;
 /** Ped ids from the head of the queue back (`m_ArrivedPeds`). */
 readonly peds:number[]=[];
 constructor(readonly effect:AttractorEffect,private random:()=>number=Math.random){this.params=attractorParams(effect.type);}
 get hasEmptySlot(){return this.peds.length<this.params.maxPeds;}
 slotOf(ped:number){return this.peds.indexOf(ped);}
 /** CPedAttractor::ComputeAttractPos in native space: slot `i` sits `spacing × i` back along the queue direction,
  * jittered for every slot but the head. */
 slotPosition(slot:number):[number,number,number]{
  const e=this.effect,s=this.params.spacing*slot;
  const pos:[number,number,number]=[e.position[0]-s*e.queueDir[0],e.position[1]-s*e.queueDir[1],e.position[2]-s*e.queueDir[2]];
  if(slot){pos[0]+=this.delta(this.params.deltaPos);pos[1]+=this.delta(this.params.deltaPos);}
  return pos;
 }
 /** CPedAttractor::ComputeAttractHeading: the head faces the use direction, the queue the queue direction. */
 slotHeading(slot:number){
  const e=this.effect;
  return slot?attractorHeading(e.queueDir)+this.delta(this.params.deltaHeading):attractorHeading(e.useDir);
 }
 /** CPedAttractor::RegisterPed: the ped takes the next slot; false when the queue is full or already holds it. */
 register(ped:number){
  if(this.peds.includes(ped)||!this.hasEmptySlot)return -1;
  this.peds.push(ped);return this.peds.length-1;
 }
 /** CPedAttractor::BroadcastDeparture: the ped leaves and everyone behind moves up a slot, slot `i` after `2i` s. */
 depart(ped:number):{ped:number;slot:number;delaySeconds:number}[]{
  const idx=this.peds.indexOf(ped);if(idx<0)return [];
  this.peds.splice(idx,1);
  return this.peds.slice(idx).map((id,k)=>({ped:id,slot:idx+k,delaySeconds:2*(idx+k)}));
 }
 private delta(range:number){return (this.random()*2-1)*range;}
}
