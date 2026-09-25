import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmScriptedTask,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {DONT_REPEAT,MAX_SEQUENCE_TASKS,NUM_SEQUENCES,REPEAT_FOREVER} from '../src/engine/ScmSequences';
import {scmOpcode} from '../src/engine/scmOpcodes';

/** Script space: the instruction at 0 and the global variables after it. */
const SPACE=512,VAR=400;
function run(code:Uint8Array,game:ScmGameState,world?:Partial<ScmWorldCommands>,globals:Record<number,number>={}){
 const space=new Uint8Array(SPACE);space.set(code,0);
 const view=new DataView(space.buffer);for(const [at,value] of Object.entries(globals))view.setInt32(+at,value,true);
 const adapter={fade(){},...world} as ScmWorldCommands;
 const host:ScmThreadHost={startScript(){},game,world:adapter};
 const thread=new ScmThread(space,0,0,new DataView(new ArrayBuffer(1024*4)),host);
 try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return {thread,global:(at:number)=>view.getInt32(at,true)};
}
function build(opcode:number,parts:{type:number;value:number}[]){
 const size=(type:number)=>type===4?2:type===2?3:5;
 const bytes=new Uint8Array(2+parts.reduce((n,part)=>n+size(part.type),0));
 const view=new DataView(bytes.buffer);view.setUint16(0,opcode,true);
 let at=2;
 for(const part of parts){
  bytes[at]=part.type;
  if(part.type===4)bytes[at+1]=part.value;else if(part.type===2)view.setUint16(at+1,part.value,true);else view.setInt32(at+1,part.value,true);
  at+=size(part.type);
 }
 return bytes;
}
const int=(value:number)=>({type:1,value});
const byte=(value:number)=>({type:4,value});
const gvar=(offset:number)=>({type:2,value:offset});
const task=(target:number):ScmScriptedTask=>({kind:'turnToFaceEntity',target});

describe('the sequences a script records',()=>{
 test('opening hands the script a handle to the first free slot, which becomes the active one',()=>{
  const game=new ScmGameState();
  const {global}=run(build(scmOpcode('OPEN_SEQUENCE_TASK'),[gvar(VAR)]),game);
  // CTheScripts::GetNewUniqueScriptThingIndex: the slot's id moves from 1 to 2, and the handle is id << 16 | slot.
  expect(global(VAR)).toBe(2<<16|0);
  expect(game.sequences.active).toBe(0);
  expect(game.sequences.at(0).opened).toBe(true);
  expect(game.sequences.index(global(VAR))).toBe(0);
 });

 test('three sequences opened in a row each get their own slot and keep their own tasks',()=>{
  // INTRO1 opens three before performing any; all three used to land in slot 0 and the last won.
  const game=new ScmGameState(),handles:number[]=[];
  for(let i=0;i<3;i++){
   handles.push(game.sequences.open());game.sequences.addTaskToActiveSequence(task(i));game.sequences.close(handles[i]);
  }
  expect(handles.map(h=>game.sequences.index(h))).toEqual([0,1,2]);
  expect(handles.map(h=>game.sequences.sequenceFor(h)!.sequence.tasks)).toEqual([[task(0)],[task(1)],[task(2)]]);
 });

 test('closing leaves nothing active, and recording then fails',()=>{
  const game=new ScmGameState();
  const {global}=run(build(scmOpcode('OPEN_SEQUENCE_TASK'),[gvar(VAR)]),game);
  run(build(scmOpcode('CLOSE_SEQUENCE_TASK'),[gvar(VAR)]),game,undefined,{[VAR]:global(VAR)});
  expect(game.sequences.active).toBe(-1);
  expect(game.sequences.at(0).opened).toBe(false);
  expect(()=>game.sequences.addTaskToActiveSequence(task(1))).toThrow('no sequence open');
 });

 test('a sequence holds eight tasks and drops the ninth',()=>{
  const game=new ScmGameState();
  game.sequences.open();
  for(let i=0;i<MAX_SEQUENCE_TASKS;i++)expect(game.sequences.addTaskToActiveSequence(task(i))).toBe(true);
  expect(game.sequences.addTaskToActiveSequence(task(99))).toBe(false);
  expect(game.sequences.at(0).tasks).toHaveLength(MAX_SEQUENCE_TASKS);
 });

 test('clearing empties the slot, takes its repeat mode, and lets the script handle go',()=>{
  const game=new ScmGameState();
  const handle=game.sequences.open();
  game.sequences.addTaskToActiveSequence(task(1));
  run(build(scmOpcode('SET_SEQUENCE_TO_REPEAT'),[int(handle),byte(1)]),game);
  expect(game.sequences.at(0).repeatMode).toBe(REPEAT_FOREVER);
  run(build(scmOpcode('CLEAR_SEQUENCE_TASK'),[int(handle)]),game);
  expect(game.sequences.at(0).tasks).toHaveLength(0);
  expect(game.sequences.at(0).repeatMode).toBe(DONT_REPEAT);
  // Clearing does not close the slot, so it is still the active one; the old handle names nothing now.
  expect(game.sequences.active).toBe(0);
  expect(game.sequences.index(handle)).toBe(-1);
  // Opened again, the slot is the script's under a new handle, and the old one still names nothing.
  game.sequences.close(handle);game.sequences.at(0).opened=false;
  const again=game.sequences.open();
  expect(game.sequences.index(again)).toBe(0);expect(again).not.toBe(handle);expect(game.sequences.index(handle)).toBe(-1);
 });

 test('the repeat command checks the handle it is given and then sets the active sequence',()=>{
  const game=new ScmGameState();
  const other=game.sequences.open();game.sequences.close(other);
  const active=game.sequences.open();
  // The handle names a different slot, and the active one takes the repeat mode anyway.
  run(build(scmOpcode('SET_SEQUENCE_TO_REPEAT'),[int(other),byte(1)]),game);
  expect(game.sequences.sequenceFor(active)!.sequence.repeatMode).toBe(REPEAT_FOREVER);
  expect(game.sequences.sequenceFor(other)!.sequence.repeatMode).toBe(DONT_REPEAT);
  // A handle naming no sequence does nothing at all.
  game.sequences.sequenceFor(active)!.sequence.repeatMode=DONT_REPEAT;
  run(build(scmOpcode('SET_SEQUENCE_TO_REPEAT'),[int(NUM_SEQUENCES),byte(1)]),game);
  expect(game.sequences.sequenceFor(active)!.sequence.repeatMode).toBe(DONT_REPEAT);
 });

 test('performing a sequence hands its tasks and repeat flag to the ped, and a stale handle gives nothing',()=>{
  const game=new ScmGameState();
  const performed:{ped:number;tasks:readonly ScmScriptedTask[];repeat:boolean;opcode:number}[]=[];
  const handle=game.sequences.open();
  game.sequences.addTaskToActiveSequence(task(11));
  game.sequences.addTaskToActiveSequence(task(12));
  run(build(scmOpcode('SET_SEQUENCE_TO_REPEAT'),[int(handle),byte(1)]),game);
  run(build(scmOpcode('CLOSE_SEQUENCE_TASK'),[int(handle)]),game);
  const world={givePedSequence:(ped:number,tasks:readonly ScmScriptedTask[],repeat:boolean,opcode:number)=>{performed.push({ped,tasks,repeat,opcode});}};
  run(build(scmOpcode('PERFORM_SEQUENCE_TASK'),[int(60),int(handle)]),game,world);
  expect(performed).toHaveLength(1);
  expect(performed[0].ped).toBe(60);
  expect(performed[0].repeat).toBe(true);
  expect(performed[0].tasks).toEqual([task(11),task(12)]);
  expect(performed[0].opcode).toBe(scmOpcode('PERFORM_SEQUENCE_TASK'));
  run(build(scmOpcode('CLEAR_SEQUENCE_TASK'),[int(handle)]),game);
  run(build(scmOpcode('PERFORM_SEQUENCE_TASK'),[int(60),int(handle)]),game,world);
  expect(performed).toHaveLength(1);
 });

 test('a mission\'s sequences go with its cleanup, and initialising puts every slot back',()=>{
  const game=new ScmGameState();
  const mission=game.sequences.open(true);game.sequences.addTaskToActiveSequence(task(1));game.sequences.close(mission);
  const own=game.sequences.open(false);game.sequences.close(own);
  game.sequences.cleanUpMissionSequences();
  expect(game.sequences.index(mission)).toBe(-1);expect(game.sequences.at(0).tasks).toHaveLength(0);
  expect(game.sequences.index(own)).toBe(1);
  game.sequences.init();
  expect(game.sequences.active).toBe(-1);
  expect(game.sequences.index(own)).toBe(-1);
  expect(game.sequences.at(1).opened).toBe(false);
 });
});
