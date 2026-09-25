import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmScriptedTask,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {scmOpcode} from '../src/engine/scmOpcodes';

function taskHost(){
 const given:{ped:number;task:ScmScriptedTask;opcode:number}[]=[];
 const flushed:number[]=[];
 const game=new ScmGameState();
 const world:ScmWorldCommands={
  fade(){},
  givePedScriptedTask:(ped,task,opcode)=>{given.push({ped,task,opcode});},
  clearPedTasksImmediately:handle=>{flushed.push(handle);},
 };
 return {given,flushed,world,game};
}
function run(bytes:Uint8Array,world:ScmWorldCommands,game=new ScmGameState()){
 const host:ScmThreadHost={startScript(){},game,world};
 const thread=new ScmThread(bytes,0,0,new DataView(new ArrayBuffer(1024*4)),host);
 try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return thread;
}
/** opcode then int32 operands. */
function command(opcode:number,values:number[]){
 const bytes=new Uint8Array(2+values.length*5);
 const view=new DataView(bytes.buffer);
 view.setUint16(0,opcode,true);
 values.forEach((value,k)=>{bytes[2+k*5]=1;view.setInt32(3+k*5,value,true);});
 return bytes;
}

describe('the tasks a script hands a ped',()=>{
 test('a kill task reaches the ped with the command that asked for it',()=>{
  const host=taskHost();
  run(command(scmOpcode('TASK_KILL_CHAR_ON_FOOT'),[42,43]),host.world);
  expect(host.given).toHaveLength(1);
  expect(host.given[0]).toEqual({ped:42,opcode:scmOpcode('TASK_KILL_CHAR_ON_FOOT'),
   task:{kind:'killPedOnFoot',target:43,time:-1,flags:0,actionDelay:0,actionChance:0,mustBeOnFoot:true}});
 });

 test('the ducking form carries its flags, delay and chance',()=>{
  const host=taskHost();
  run(command(scmOpcode('TASK_KILL_CHAR_ON_FOOT_WHILE_DUCKING'),[7,8,3,250,60]),host.world);
  expect(host.given[0].task).toEqual({kind:'killPedOnFoot',target:8,time:-1,flags:3,actionDelay:250,actionChance:60,mustBeOnFoot:true});
 });

 test('a handle of -1 records the task into the sequence instead of giving it to a ped',()=>{
  const host=taskHost();
  host.game.sequences.open();
  run(command(scmOpcode('TASK_TURN_CHAR_TO_FACE_CHAR'),[-1,9]),host.world,host.game);
  expect(host.given).toHaveLength(0);
  expect(host.game.sequences.at(0).tasks).toEqual([{kind:'turnToFaceEntity',target:9}]);
 });

 test('clearing a ped’s tasks flushes it at once',()=>{
  const host=taskHost();
  run(command(scmOpcode('CLEAR_CHAR_TASKS_IMMEDIATELY'),[21]),host.world);
  expect(host.flushed).toEqual([21]);
 });

 test('without a world the task commands fail rather than dropping the task',()=>{
  const bare={fade(){}} as ScmWorldCommands;
  expect(()=>run(command(scmOpcode('TASK_KILL_CHAR_ON_FOOT'),[1,2]),bare)).toThrow('world adapter lacks givePedScriptedTask');
  expect(()=>run(command(scmOpcode('TASK_KILL_CHAR_ON_FOOT'),[-1,2]),bare)).toThrow('no sequence open');
 });
});
