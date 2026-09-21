import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmScriptedTask,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {scmOpcode} from '../src/engine/scmOpcodes';

const CODE=512;
function instruction(opcode:number,operands:readonly (readonly [number,number]|string)[]){
 const out:number[]=[opcode&0xff,opcode>>8&0xff];
 for(const operand of operands){
  if(typeof operand==='string'){out.push(14,operand.length,...[...operand].map(c=>c.charCodeAt(0)));continue;}
  const [type,value]=operand;
  const bytes=new Uint8Array(4),view=new DataView(bytes.buffer);
  if(type===1){view.setInt32(0,value,true);out.push(1,...bytes);}
  else if(type===6){view.setFloat32(0,value,true);out.push(6,...bytes);}
  else {view.setUint16(0,value,true);out.push(type,bytes[0],bytes[1]);}
 }
 return out;
}
const int=(value:number)=>[1,value] as const;
const float=(value:number)=>[6,value] as const;
/** Runs a command and returns the task it gave the ped, or the sequence it recorded into. */
function given(...instructions:number[][]){
 const tasks:{ped:number;task:ScmScriptedTask;opcode:number}[]=[];
 const game=new ScmGameState();
 const space=new Uint8Array(2048);space.set(instructions.flat(),CODE);
 const host:ScmThreadHost={startScript(){},game,world:{fade(){},
  givePedScriptedTask:(ped:number,task:ScmScriptedTask,opcode:number)=>{tasks.push({ped,task,opcode});},
 } as ScmWorldCommands};
 const thread=new ScmThread(space,CODE,0,undefined,host);
 try{thread.run(0,16);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return {tasks,game};
}
const PED=7,CAR=9;
const op=scmOpcode;

describe('the tasks a script hands its peds',()=>{
 test('the walk task carries its point, its move state and its time limit',()=>{
  const {tasks}=given(instruction(op('TASK_GO_STRAIGHT_TO_COORD'),
   [int(PED),float(10),float(20),float(3),int(2),int(5000)]));
  expect(tasks).toEqual([{ped:PED,opcode:op('TASK_GO_STRAIGHT_TO_COORD'),
   task:{kind:'goStraightToCoord',x:10,y:20,z:3,speed:2,time:5000}}]);
 });

 test('the path-node walk is its own task, not the straight one',()=>{
  const {tasks}=given(instruction(op('TASK_FOLLOW_PATH_NODES_TO_COORD'),
   [int(PED),float(1),float(2),float(3),int(1),int(-1)]));
  expect(tasks[0].task).toMatchObject({kind:'followPathNodesToCoord',speed:1,time:-1});
 });

 test('the two animation tasks share every operand and differ only in being interruptable',()=>{
  const operands=[int(PED),'RUN','PED',float(4),int(1),int(0),int(1),int(0),int(-1)] as const;
  const plain=given(instruction(op('TASK_PLAY_ANIM'),operands));
  expect(plain.tasks[0].task).toEqual({kind:'playAnim',animationName:'RUN',animationFile:'PED',blendSpeed:4,
   loop:true,lockX:false,lockY:true,keepLastFrame:false,time:-1,interruptable:true});
  const locked=given(instruction(op('TASK_PLAY_ANIM_NON_INTERRUPTABLE'),operands));
  expect(locked.tasks[0].task).toMatchObject({kind:'playAnim',interruptable:false,animationName:'RUN'});
 });

 test('the simple tasks carry the one thing each of them names',()=>{
  const cases:[string,readonly (readonly [number,number])[],Record<string,unknown>][]=[
   ['TASK_STAY_IN_SAME_PLACE',[int(PED),int(1)],{kind:'stayInSamePlace',state:true}],
   ['TASK_TOGGLE_DUCK',[int(PED),int(0)],{kind:'toggleDuck',state:false}],
   ['TASK_ACHIEVE_HEADING',[int(PED),float(90)],{kind:'achieveHeading',heading:90}],
   ['TASK_PAUSE',[int(PED),int(2000)],{kind:'pause',time:2000}],
   ['TASK_LEAVE_ANY_CAR',[int(PED)],{kind:'leaveAnyCar'}],
   ['TASK_LOOK_AT_CHAR',[int(PED),int(8),int(3000)],{kind:'lookAtPed',target:8,time:3000}],
  ];
  for(const [name,operands,expected] of cases){
   const {tasks}=given(instruction(op(name),operands));
   expect(tasks[0].task,name).toEqual(expected);
  }
 });

 test('the driving task names two styles, one either side of the model it may swap to',()=>{
  const {tasks}=given(instruction(op('TASK_CAR_DRIVE_TO_COORD'),
   [int(PED),int(CAR),float(100),float(200),float(10),float(25),int(4),int(411),int(2)]));
  expect(tasks[0].task).toEqual({kind:'carDriveToCoord',vehicle:CAR,x:100,y:200,z:10,
   speed:25,driveStyle:4,model:411,drivingStyle:2});
 });

 test('the drive-by task carries its two targets, its point and its rate',()=>{
  const {tasks}=given(instruction(op('TASK_DRIVE_BY'),
   [int(PED),int(8),int(CAR),float(1),float(2),float(3),float(15),int(3),int(1),int(200)]));
  expect(tasks[0].task).toEqual({kind:'driveBy',targetPed:8,targetVehicle:CAR,x:1,y:2,z:3,
   radius:15,type:3,rightHandCarSeat:true,fireRate:200});
 });

 test('a handle of minus one records the task into the open sequence instead of giving it to a ped',()=>{
  // With no sequence open the runtime refuses, which is what the sequence table already does.
  expect(()=>given(instruction(op('TASK_PAUSE'),[int(-1),int(500)]))).toThrow(/no sequence open/);
  const withSequence=new ScmGameState();
  withSequence.sequences.open(0);
  const space=new Uint8Array(2048);space.set(instruction(op('TASK_PAUSE'),[int(-1),int(500)]),CODE);
  const thread=new ScmThread(space,CODE,0,undefined,{startScript(){},game:withSequence,world:{fade(){}} as ScmWorldCommands});
  try{thread.run(0,4);}catch(error){if(!String(error).includes('watchdog'))throw error;}
  expect(withSequence.sequences.at(0).tasks).toEqual([{kind:'pause',time:500}]);
  // The ped never saw it: the sequence took it instead.
  expect(withSequence.sequences.active).toBe(0);
 });
});

describe('the route a task follows',()=>{
 test('points are added one at a time and the flush empties them',()=>{
  const {game}=given(
   instruction(op('EXTEND_ROUTE'),[float(1),float(2),float(3)]),
   instruction(op('EXTEND_ROUTE'),[float(4),float(5),float(6)]));
  expect(game.route).toEqual([{x:1,y:2,z:3},{x:4,y:5,z:6}]);
  const flushed=given(
   instruction(op('EXTEND_ROUTE'),[float(1),float(2),float(3)]),
   instruction(op('FLUSH_ROUTE'),[]));
  expect(flushed.game.route).toEqual([]);
 });
});
