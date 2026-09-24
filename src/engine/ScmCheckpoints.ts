import {requireAsset} from '../assets/binary';
import {scriptThingHandle} from './ScmFires';
import {CHECKPOINT,NativeCheckpoints} from '../world/nativeCheckpoints';
/* The checkpoints a script places (CTheScripts::ScriptCheckpointArray), whose operands come from the pinned Sanny
 * Builder schema this project generates its opcode table from: a type, the point it stands at, the point it aims at
 * and a radius. This is the table the script addresses by handle, wrapped in the same script-thing handle every other
 * table here uses; each entry is placed in CCheckpoints (world/nativeCheckpoints.ts), which draws it. The
 * SET_CHECKPOINT_COORDS and _HEADING handlers are not reversed: they go to CCheckpoints::UpdatePos and SetHeading by
 * the handle, the id AddScriptCheckpoint placed it with. */
export const MAX_CHECKPOINTS=32;
export interface ScmCheckpoint {
 index:number;type:number;
 position:{x:number;y:number;z:number};
 pointAt:{x:number;y:number;z:number};
 radius:number;referenceIndex:number;
}
/** CTheScripts::AddScriptCheckpoint's colour: red at alpha 32 for tubes, 96 for tori. */
export function scriptCheckpointColour(type:number):[number,number,number,number]{
 if(type===CHECKPOINT.tube||type===CHECKPOINT.endTube||type===CHECKPOINT.emptyTube)return [255,0,0,32];
 requireAsset(type>=CHECKPOINT.torus&&type<=CHECKPOINT.torusDown,'Invalid checkpoint type.');
 return [255,0,0,96];
}
export class ScmCheckpoints {
 /** CCheckpoints, which CTheScripts::AddScriptCheckpoint places each one in with its handle as the id. */
 constructor(readonly markers=new NativeCheckpoints()){}
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
  // PlaceMarker with pulse period 1024, pulse fraction 0.075 and no rotation.
  this.markers.placeMarker(handle,type,[position.x,position.y,position.z],[pointAt.x,pointAt.y,pointAt.z],radius,scriptCheckpointColour(type),1024,.075,0);
  return handle;
 }
 /** GetActualScriptThingIndex: the slot, only while its reference counter is the handle's. */
 at(handle:number){
  const index=ScmCheckpoints.indexOf(handle);
  requireAsset(Number.isInteger(index)&&index>=0&&index<MAX_CHECKPOINTS,'Checkpoint handle out of range.');
  const slot=this.slots[index];return slot&&slot.referenceIndex===handle>>>16?slot:undefined;
 }
 /** DELETE_CHECKPOINT (RemoveScriptCheckpoint), which does nothing for a stale handle or one naming an empty slot, and
  * otherwise deletes the placed checkpoint of that id and type (CCheckpoints::DeleteCP). */
 remove(handle:number){
  const index=ScmCheckpoints.indexOf(handle),slot=index>=0&&index<MAX_CHECKPOINTS?this.slots[index]:undefined;
  if(slot?.referenceIndex!==handle>>>16)return;
  const placed=this.markers.checkpoints.find(c=>c.used&&c.id===handle);
  if(placed)this.markers.deleteCP(handle,placed.type);
  this.slots[index]=undefined;
 }
 /** SET_CHECKPOINT_COORDS: CCheckpoints::UpdatePos for the handle's checkpoint. */
 setCoords(handle:number,position:{x:number;y:number;z:number}){if(this.at(handle))this.markers.updatePos(handle,[position.x,position.y,position.z]);}
 /** SET_CHECKPOINT_HEADING: CCheckpoints::SetHeading. */
 setHeading(handle:number,headingDeg:number){if(this.at(handle))this.markers.setHeading(handle,headingDeg);}
 get count(){return this.slots.filter(Boolean).length;}
 get all():readonly ScmCheckpoint[]{return this.slots.filter(Boolean) as ScmCheckpoint[];}
}
