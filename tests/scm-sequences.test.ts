import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmScriptedTask,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {DONT_REPEAT,MAX_SEQUENCE_TASKS,NUM_SEQUENCES,REPEAT_FOREVER} from '../src/engine/ScmSequences';
import {scmOpcode} from '../src/engine/scmOpcodes';

function run(bytes:Uint8Array,game:ScmGameState,world?:Partial<ScmWorldCommands>){
 const adapter={fade(){},...world} as ScmWorldCommands;
 const host:ScmThreadHost={startScript(){},game,world:adapter};
 const thread=new ScmThread(bytes,0,0,new DataView(new ArrayBuffer(1024*4)),host);
 try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return thread;
}
function build(opcode:number,parts:{type:number;value:number}[]){
 const size=(type:number)=>type===4?2:5;
 const bytes=new Uint8Array(2+parts.reduce((n,part)=>n+size(part.type),0));
 const view=new DataView(bytes.buffer);view.setUint16(0,opcode,true);
 let at=2;
 for(const part of parts){
  bytes[at]=part.type;
  if(part.type===4)bytes[at+1]=part.value;else view.setInt32(at+1,part.value,true);
  at+=size(part.type);
 }
 return bytes;
}
const int=(value:number)=>({type:1,value});
const byte=(value:number)=>({type:4,value});
const task=(target:number):ScmScriptedTask=>({kind:'turnToFaceEntity',target});

describe('the sequences a script records',()=>{
 test('opening a sequence makes it the active one and empties it first',()=>{
  const game=new ScmGameState();
  game.sequences.open(5);
  game.sequences.addTaskToActiveSequence(task(1));
  expect(game.sequences.at(5).tasks).toHaveLength(1);
  run(build(scmOpcode('OPEN_SEQUENCE_TASK'),[int(5)]),game);
  expect(game.sequences.active).toBe(5);
  expect(game.sequences.at(5).opened).toBe(true);
  expect(game.sequences.at(5).tasks).toHaveLength(0);
 });

 test('closing leaves nothing active, and recording then fails',()=>{
  const game=new ScmGameState();
  run(build(scmOpcode('OPEN_SEQUENCE_TASK'),[int(2)]),game);
  run(build(scmOpcode('CLOSE_SEQUENCE_TASK'),[int(2)]),game);
  expect(game.sequences.active).toBe(-1);
  expect(game.sequences.at(2).opened).toBe(false);
  expect(()=>game.sequences.addTaskToActiveSequence(task(1))).toThrow('no sequence open');
 });

 test('a sequence holds eight tasks and drops the ninth',()=>{
  const game=new ScmGameState();
  game.sequences.open(0);
  for(let i=0;i<MAX_SEQUENCE_TASKS;i++)expect(game.sequences.addTaskToActiveSequence(task(i))).toBe(true);
  expect(game.sequences.addTaskToActiveSequence(task(99))).toBe(false);
  expect(game.sequences.at(0).tasks).toHaveLength(MAX_SEQUENCE_TASKS);
 });

 test('clearing empties the slot and takes its repeat mode with it',()=>{
  const game=new ScmGameState();
  game.sequences.open(7);
  game.sequences.addTaskToActiveSequence(task(1));
  run(build(scmOpcode('SET_SEQUENCE_TO_REPEAT'),[int(7),byte(1)]),game);
  expect(game.sequences.at(7).repeatMode).toBe(REPEAT_FOREVER);
  run(build(scmOpcode('CLEAR_SEQUENCE_TASK'),[int(7)]),game);
  expect(game.sequences.at(7).tasks).toHaveLength(0);
  expect(game.sequences.at(7).repeatMode).toBe(DONT_REPEAT);
  // Clearing does not close the slot, so it is still the active one.
  expect(game.sequences.active).toBe(7);
 });

 test('the repeat command checks the index it is given and then sets the active sequence',()=>{
  const game=new ScmGameState();
  game.sequences.open(4);
  // The index names a different slot, and the active one takes the repeat mode anyway.
  run(build(scmOpcode('SET_SEQUENCE_TO_REPEAT'),[int(9),byte(1)]),game);
  expect(game.sequences.at(4).repeatMode).toBe(REPEAT_FOREVER);
  expect(game.sequences.at(9).repeatMode).toBe(DONT_REPEAT);
  // An index outside the array does nothing at all.
  game.sequences.at(4).repeatMode=DONT_REPEAT;
  run(build(scmOpcode('SET_SEQUENCE_TO_REPEAT'),[int(NUM_SEQUENCES),byte(1)]),game);
  expect(game.sequences.at(4).repeatMode).toBe(DONT_REPEAT);
 });

 test('performing a sequence hands its tasks and repeat flag to the ped',()=>{
  const game=new ScmGameState();
  const performed:{ped:number;tasks:readonly ScmScriptedTask[];repeat:boolean;opcode:number}[]=[];
  game.sequences.open(1);
  game.sequences.addTaskToActiveSequence(task(11));
  game.sequences.addTaskToActiveSequence(task(12));
  run(build(scmOpcode('SET_SEQUENCE_TO_REPEAT'),[int(1),byte(1)]),game);
  run(build(scmOpcode('CLOSE_SEQUENCE_TASK'),[int(1)]),game);
  run(build(scmOpcode('PERFORM_SEQUENCE_TASK'),[int(60),int(1)]),game,{givePedSequence:(ped,tasks,repeat,opcode)=>{performed.push({ped,tasks,repeat,opcode});}});
  expect(performed).toHaveLength(1);
  expect(performed[0].ped).toBe(60);
  expect(performed[0].repeat).toBe(true);
  expect(performed[0].tasks).toEqual([task(11),task(12)]);
  expect(performed[0].opcode).toBe(scmOpcode('PERFORM_SEQUENCE_TASK'));
 });

 test('initialising puts every slot back and leaves nothing active',()=>{
  const game=new ScmGameState();
  game.sequences.open(3);
  game.sequences.addTaskToActiveSequence(task(1));
  game.sequences.init();
  expect(game.sequences.active).toBe(-1);
  expect(game.sequences.at(3).tasks).toHaveLength(0);
  expect(game.sequences.at(3).opened).toBe(false);
 });
});
