import {requireAsset} from '../assets/binary';
import type {ScmScriptedTask} from './ScmThread';
/* CTaskSequences and the container half of CTaskComplexSequence, pinned gta-reversed ead3051
 * (`TaskSequences.cpp` 0x632D90 and 0x632DD0, `TaskComplexSequence.cpp`'s AddTask 0x632D20, Flush 0x632CC0 and
 * SetRepeatMode 0x638BE0, all reversed): the sixty-four sequences a script records tasks into and then hands
 * to a ped. Running a sequence belongs to a host; this is what the script builds. */
/** CTaskSequences::NUM_SEQUENCES. */
export const NUM_SEQUENCES=64;
/** CTaskComplexSequence holds eight tasks; a ninth is dropped rather than stored. */
export const MAX_SEQUENCE_TASKS=8;
/** eRepeatMode. */
export const DONT_REPEAT=0,REPEAT_FOREVER=1;
export interface ScmSequence {
 tasks:ScmScriptedTask[];
 /** ms_bIsOpened: whether the script still has this sequence open for recording. */
 opened:boolean;
 repeatMode:number;
 /** m_CurrTaskIdx and m_RepeatedCnt, which a flush puts back to nothing. */
 currentTask:number;repeatedCount:number;
}
const emptySequence=():ScmSequence=>({tasks:[],opened:false,repeatMode:DONT_REPEAT,currentTask:0,repeatedCount:0});
export class ScmSequences {
 readonly sequences:ScmSequence[]=Array.from({length:NUM_SEQUENCES},emptySequence);
 /** ms_iActiveSequence: the one being recorded into, or -1 for none. */
 active=-1;
 /** CTheScripts::ScriptSequenceTaskArray: whether a script holds each slot (m_bUsed) and the slot's m_nId, which a new
  * handle bumps (tScriptSequence starts it at 1). A script names a sequence by (m_nId << 16 | slot), never by slot. */
 readonly scriptUsed:boolean[]=new Array(NUM_SEQUENCES).fill(false);
 readonly scriptIds:number[]=new Array(NUM_SEQUENCES).fill(1);
 /** The slots a mission opened, which its cleanup clears (CMissionCleanup's MISSION_CLEANUP_ENTITY_TYPE_SEQUENCE). */
 readonly missionSlots=new Set<number>();
 /** CTaskSequences::Init (0x632D90): no sequence is active and every slot is flushed and closed; with CTheScripts::Init
  * the scripts hold no slot and every id starts again at 1. */
 init(){this.active=-1;this.cleanUpForShutdown();this.scriptUsed.fill(false);this.scriptIds.fill(1);this.missionSlots.clear();}
 /** CTaskSequences::CleanUpForShutdown (0x632DD0). */
 cleanUpForShutdown(){for(let i=0;i<NUM_SEQUENCES;i++){this.sequences[i].opened=false;this.flush(i);}}
 at(index:number){
  requireAsset(Number.isInteger(index)&&index>=0&&index<NUM_SEQUENCES,'Sequence index out of range.');
  return this.sequences[index];
 }
 /** CTaskComplexSequence::Flush: the tasks go, and the progress and repeat mode with them. */
 flush(index:number){
  const sequence=this.at(index);
  sequence.tasks=[];sequence.currentTask=0;sequence.repeatedCount=0;sequence.repeatMode=DONT_REPEAT;
 }
 /** CTaskSequences::GetAvailableSlot (unreversed): the first slot that is neither being recorded nor held by a
  * script. -1 with all sixty-four taken. */
 availableSlot(){for(let i=0;i<NUM_SEQUENCES;i++)if(!this.sequences[i].opened&&!this.scriptUsed[i])return i;return -1;}
 /** CTheScripts::GetNewUniqueScriptThingIndex for a sequence: the slot is the script's, and its id moves on (-1 and -2
  * start again at 1; the id is an int16). */
 private newHandle(slot:number){
  this.scriptUsed[slot]=true;
  const id=this.scriptIds[slot],next=id===-1||id===-2?1:(id+1)<<16>>16;
  this.scriptIds[slot]=next;
  return (next<<16|slot)|0;
 }
 /** CTheScripts::GetActualScriptThingIndex for a sequence: the slot a handle names, or -1 when it names none (-1
  * itself, a slot the script let go, or an older handle to a slot used again since). */
 index(handle:number){
  if(handle===-1)return -1;
  const slot=handle&0xffff,id=handle>>>16&0xffff;
  return slot<NUM_SEQUENCES&&this.scriptUsed[slot]&&(this.scriptIds[slot]&0xffff)===id?slot:-1;
 }
 /** OPEN_SEQUENCE_TASK: a free slot becomes the active one and takes the tasks that follow; the script gets its
  * handle back. A mission's sequence is on the mission's cleanup list. */
 open(missionCleanup=false){
  const slot=this.availableSlot();requireAsset(slot>=0,'Every task sequence is in use.');
  this.flush(slot);this.sequences[slot].opened=true;this.active=slot;
  if(missionCleanup)this.missionSlots.add(slot);
  return this.newHandle(slot);
 }
 /** CLOSE_SEQUENCE_TASK: the script is done recording, and nothing is active until it opens another. */
 close(handle:number){const slot=this.index(handle);if(slot<0)return;this.sequences[slot].opened=false;if(this.active===slot)this.active=-1;}
 /** CLEAR_SEQUENCE_TASK: the slot's tasks go and the script lets the slot go, without touching which one is open. */
 clear(handle:number){const slot=this.index(handle);if(slot<0)return;this.flush(slot);this.scriptUsed[slot]=false;this.missionSlots.delete(slot);}
 /** The sequence a handle names, or nothing. */
 sequenceFor(handle:number){const slot=this.index(handle);return slot<0?undefined:{slot,sequence:this.sequences[slot]};}
 /** CMissionCleanup::Process for the sequences a mission opened: each is cleared as CLEAR_SEQUENCE_TASK would. */
 cleanUpMissionSequences(){for(const slot of [...this.missionSlots]){this.flush(slot);this.sequences[slot].opened=false;if(this.active===slot)this.active=-1;this.scriptUsed[slot]=false;}this.missionSlots.clear();}
 /** CTaskSequences::AddTaskToActiveSequence with CTaskComplexSequence::AddTask: the first free slot of eight
  * takes the task, and a ninth is dropped rather than stored. Returns whether it was kept. */
 addTaskToActiveSequence(task:ScmScriptedTask){
  requireAsset(this.active>=0,'A task was recorded with no sequence open.');
  const sequence=this.at(this.active);
  if(sequence.tasks.length>=MAX_SEQUENCE_TASKS)return false;
  sequence.tasks.push(task);return true;
 }
 /** SET_SEQUENCE_TO_REPEAT: the handler checks the index it is given and then sets the repeat mode of the
  * active sequence, not of the one it just checked, which is what the reversed command does. */
 setRepeatMode(handle:number,repeat:boolean){
  if(this.index(handle)<0)return;
  if(this.active<0)return;
  this.at(this.active).repeatMode=repeat?REPEAT_FOREVER:DONT_REPEAT;
 }
}
