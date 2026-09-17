import {requireAsset} from '../assets/binary';
import {readScmHeader} from '../assets/scm';
import {ScmGameState} from './ScmGameState';
import {ScmThread,type ScmWorldCommands} from './ScmThread';

/** CTheScripts::MAIN_SCRIPT_SIZE and MISSION_SCRIPT_SIZE: ScriptSpace holds
 * MAIN.SCM in its lower part and the current mission block above it. */
export const MAIN_SCRIPT_SIZE=200000,MISSION_SCRIPT_SIZE=69000,SCRIPT_SPACE_SIZE=MAIN_SCRIPT_SIZE+MISSION_SCRIPT_SIZE;
/** LocalVariablesForCurrentMission entries (tScriptParam). */
export const MISSION_LOCAL_COUNT=1024;
const TIMER_A=32,TIMER_B=33;

interface Slot {id:number;thread:ScmThread;timers:DataView;retired?:boolean;next?:Slot;previous?:Slot}
/** MAIN.SCM bytes plus MultiScriptArray offsets and the exclusive-mission count. */
export interface ScmMissionSource {file:Uint8Array;offsets:readonly number[];exclusiveMissions:number;objectNames?:readonly string[]}

/** Ordinary and mission script scheduling from CTheScripts::Process and
 * CRunningScript::Process. Native active-list order, local and mission
 * timers, mission loading, fail/death-arrest resets are implemented; mission
 * cleanup, streamed scripts, replay, saves and most world commands remain
 * outside this runtime. */
export class ScmRuntime {
 private head?:Slot;
 // Init prepends each of ScriptsArray's 96 entries: slot 95 is allocated first.
 private readonly idle=Array.from({length:96},(_,i)=>95-i);
 private processing=false;
 /** LocalVariablesForCurrentMission, shared by every mission thread. */
 readonly missionLocals=new DataView(new ArrayBuffer(MISSION_LOCAL_COUNT*4));
 private readonly globals:DataView;
 constructor(readonly scriptSpace:Uint8Array,readonly world?:ScmWorldCommands,readonly random?:{next():number},readonly game=new ScmGameState(),private readonly missionSource?:ScmMissionSource){
  this.globals=new DataView(scriptSpace.buffer,scriptSpace.byteOffset,scriptSpace.byteLength);
 }
 /** CTheScripts::Init layout: the first MAIN_SCRIPT_SIZE bytes of MAIN.SCM in
  * ScriptSpace, mission offsets from the header, missions read from the file. */
 static load(file:Uint8Array,world?:ScmWorldCommands,random?:{next():number},game?:ScmGameState){
  const header=readScmHeader(file);
  const scriptSpace=new Uint8Array(SCRIPT_SPACE_SIZE);scriptSpace.set(file.subarray(0,MAIN_SCRIPT_SIZE));
  const runtime=new ScmRuntime(scriptSpace,world,random,game,{file,offsets:header.missions.map(m=>m.start),exclusiveMissions:header.exclusiveMissions,objectNames:header.objectNames});
  return {runtime,header};
 }
 get active(){const list:{id:number;thread:ScmThread}[]=[];for(let s=this.head;s;s=s.next)list.push({id:s.id,thread:s.thread});return list;}
 /** Any active thread flagged m_ThisMustBeTheOnlyMissionRunning. */
 get missionRunning(){for(let s=this.head;s;s=s.next)if(s.thread.thisMustBeTheOnlyMissionRunning)return true;return false;}
 start(entry:number,argumentBits:readonly number[]=[],options:{base?:number;mission?:boolean}={}){
  requireAsset(this.idle.length>0,'SCM script pool exhausted (96 slots).');
  requireAsset(argumentBits.length<=34,'SCM new-thread arguments exceed local storage.');
  const own=new DataView(new ArrayBuffer(34*4));
  argumentBits.forEach((bits,i)=>own.setInt32(i*4,bits,true));
  const host={startScript:(address:number,args:readonly number[])=>{this.start(address,args);},world:this.world,game:this.game,
   nextRandom:this.random?()=>this.random!.next():undefined,
   loadMission:(id:number)=>this.loadAndLaunchMission(id),launchMission:(label:number)=>{this.start(label);},
   terminateAllWithName:(name:string)=>this.terminateAllWithName(name),objectNames:this.missionSource?.objectNames};
  // Mission threads address LocalVariablesForCurrentMission; their own
  // m_LocalVars still receive the per-thread timer updates.
  const thread=new ScmThread(this.scriptSpace,entry,options.base??0,options.mission?this.missionLocals:own,host);
  if(options.mission){thread.usesMissionCleanup=true;thread.thisMustBeTheOnlyMissionRunning=true;}
  const slot:Slot={id:this.idle.shift()!,thread,timers:own,next:this.head};
  if(this.head)this.head.previous=slot;
  this.head=slot;
  return {id:slot.id,thread};
 }
 /** LoadAndLaunchMissionInternal (MissionCommands.cpp). The mission block is
  * read over the previous one without clearing, mission locals are wiped and
  * the new thread runs on the next pass. CTimer suspension and
  * CGameLogic::ClearSkip have no runtime counterpart here. */
 loadAndLaunchMission(missionId:number){
  const source=this.missionSource;requireAsset(source,'Mission loading requires ScmRuntime.load with the original MAIN.SCM.');
  if(source.exclusiveMissions>0){if(missionId<=0xffff-3)return;missionId=0xffff-missionId;}
  requireAsset(Number.isInteger(missionId)&&missionId>=0&&missionId<source.offsets.length,`Mission ${missionId} is outside the MultiScriptArray.`);
  const offset=source.offsets[missionId];
  this.scriptSpace.set(source.file.subarray(offset,offset+MISSION_SCRIPT_SIZE),MAIN_SCRIPT_SIZE);
  new Uint8Array(this.missionLocals.buffer).fill(0);
  this.start(MAIN_SCRIPT_SIZE,[],{base:MAIN_SCRIPT_SIZE,mission:true});
  this.game.alreadyRunningAMissionScript=true;
 }
 /** TerminateAllScriptsWithThisName (ScriptCommands.cpp): case-insensitive. */
 terminateAllWithName(name:string){
  const wanted=name.toLowerCase();
  for(let slot=this.head,next:Slot|undefined;slot;slot=next){next=slot.next;if(slot.thread.name.toLowerCase()===wanted){slot.thread.terminated=true;this.retire(slot);}}
 }
 private retire(slot:Slot){
  if(slot.retired)return;slot.retired=true;
  if(slot.previous)slot.previous.next=slot.next;else this.head=slot.next;
  if(slot.next)slot.next.previous=slot.previous;
  this.idle.unshift(slot.id);
  // ShutdownThisScript (0x465AA0) is unreversed in the pinned checkout; the
  // mission-running flag is released from that routine's documented purpose.
  if(slot.thread.thisMustBeTheOnlyMissionRunning)this.game.alreadyRunningAMissionScript=false;
 }
 /** CRunningScript::DoDeathArrestCheck (0x485A50). */
 private deathArrestCheck(thread:ScmThread){
  if(!thread.deathArrestEnabled)return;
  const flag=this.game.onAMissionFlag;
  if(!(flag&&flag+4<=this.globals.byteLength&&this.globals.getUint32(flag,true)===1))return;
  // Without player info there is no restart in progress.
  if(!this.world?.isPlayerRestarting?.())return;
  this.world.clearSmallMessages?.();
  this.globals.setUint32(flag,0,true);
  thread.resetIp();thread.doneDeathArrest=true;
 }
 /** nowMs is CTimer game time; timeStepMs is its per-frame timestep in ms.
  * Call only for a running simulation frame. Waiting scripts' timers still
  * advance. New scripts are prepended and first execute on the next pass. */
 process(nowMs:number,timeStepMs:number,instructionBudget=10000){
  requireAsset(!this.processing,'SCM scheduler cannot be entered recursively.');
  requireAsset(Number.isInteger(nowMs)&&nowMs>=0&&nowMs<=0xffffffff,'Invalid SCM clock.');
  requireAsset(Number.isFinite(timeStepMs)&&timeStepMs>=0&&timeStepMs<=0x7fffffff,'Invalid SCM frame time.');
  requireAsset(Number.isInteger(instructionBudget)&&instructionBudget>0,'Invalid SCM instruction budget.');
  const delta=Math.trunc(timeStepMs);this.processing=true;
  const tick=(view:DataView)=>{for(const index of [TIMER_A,TIMER_B]){const at=index*4;view.setInt32(at,view.getInt32(at,true)+delta,true);}};
  try{
   // CTheScripts::Process: fail countdown, text-line reset, mission timers, then threads.
   if(this.game.failCurrentMission)this.game.failCurrentMission--;
   this.game.introText.beginFrame();
   tick(this.missionLocals);
   for(let slot=this.head,next:Slot|undefined;slot;slot=next){
    next=slot.next;
    // A script terminated by an earlier thread this pass keeps its list
    // pointers (as native does) but is not processed again.
    if(slot.retired)continue;
    tick(slot.timers);
    const {thread}=slot;
    // CRunningScript::Process before the command loop.
    if(thread.usesMissionCleanup)this.deathArrestCheck(thread);
    if(thread.thisMustBeTheOnlyMissionRunning&&this.game.failCurrentMission===1&&thread.stack.length>0)thread.resetIp();
    this.game.reinitialiseSwitch();
    thread.run(nowMs,instructionBudget,Math.fround(timeStepMs/20));
    if(thread.terminated)this.retire(slot);
   }
  }finally{this.processing=false;}
 }
}
