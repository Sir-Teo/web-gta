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
 /** CTaskSequences::Init (0x632D90): no sequence is active and every slot is flushed and closed. */
 init(){this.active=-1;this.cleanUpForShutdown();}
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
 /** OPEN_SEQUENCE_TASK: the slot becomes the active one and takes the tasks that follow. */
 open(index:number){const sequence=this.at(index);this.flush(index);sequence.opened=true;this.active=index;}
 /** CLOSE_SEQUENCE_TASK: the script is done recording, and nothing is active until it opens another. */
 close(index:number){this.at(index).opened=false;if(this.active===index)this.active=-1;}
 /** CLEAR_SEQUENCE_TASK: the slot's tasks go without touching which sequence is open. */
 clear(index:number){this.flush(index);}
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
 setRepeatMode(index:number,repeat:boolean){
  if(!Number.isInteger(index)||index<0||index>=NUM_SEQUENCES)return;
  if(this.active<0)return;
  this.at(this.active).repeatMode=repeat?REPEAT_FOREVER:DONT_REPEAT;
 }
}
