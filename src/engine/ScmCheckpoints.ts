import {requireAsset} from '../assets/binary';
import {scriptThingHandle} from './ScmFires';
/* The checkpoints a script places, whose operands come from the pinned Sanny Builder schema this project
 * generates its opcode table from: a type, the point it stands at, the point it aims at and a radius. Drawing
 * one belongs to a host; this is the table the script addresses by handle, wrapped in the same script-thing
 * handle every other table here uses. */
export const MAX_CHECKPOINTS=32;
export interface ScmCheckpoint {
 index:number;type:number;
 position:{x:number;y:number;z:number};
 pointAt:{x:number;y:number;z:number};
 radius:number;referenceIndex:number;
}
export class ScmCheckpoints {
 private readonly slots:(ScmCheckpoint|undefined)[]=Array(MAX_CHECKPOINTS).fill(undefined);
 /** Each slot's reference counter, which survives the slot being freed so a stale handle no longer names it. */
 private readonly counters:number[]=Array(MAX_CHECKPOINTS).fill(1);
 static indexOf(handle:number){return handle&0xffff;}
 /** CREATE_CHECKPOINT: the first free slot takes it, and a full table gives back nothing. */
 create(type:number,position:{x:number;y:number;z:number},pointAt:{x:number;y:number;z:number},radius:number){
  requireAsset([position.x,position.y,position.z,pointAt.x,pointAt.y,pointAt.z,radius].every(Number.isFinite),
   'Invalid checkpoint.');
  const index=this.slots.findIndex(slot=>!slot);
  requireAsset(index>=0,'Every checkpoint slot is taken.');
  const {handle,referenceIndex}=scriptThingHandle(index,this.counters[index]);
  this.counters[index]=referenceIndex;
  this.slots[index]={index,type,position:{...position},pointAt:{...pointAt},radius,referenceIndex};
  return handle;
 }
 /** GetActualScriptThingIndex: the slot, only while its reference counter is the handle's. */
 at(handle:number){
  const index=ScmCheckpoints.indexOf(handle);
  requireAsset(Number.isInteger(index)&&index>=0&&index<MAX_CHECKPOINTS,'Checkpoint handle out of range.');
  const slot=this.slots[index];return slot&&slot.referenceIndex===handle>>>16?slot:undefined;
 }
 /** DELETE_CHECKPOINT, which does nothing for a stale handle or one naming an empty slot. */
 remove(handle:number){const index=ScmCheckpoints.indexOf(handle);if(index>=0&&index<MAX_CHECKPOINTS&&this.slots[index]?.referenceIndex===handle>>>16)this.slots[index]=undefined;}
 get count(){return this.slots.filter(Boolean).length;}
 get all():readonly ScmCheckpoint[]{return this.slots.filter(Boolean) as ScmCheckpoint[];}
}
