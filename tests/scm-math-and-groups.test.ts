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
const gvar=(offset:number)=>[2,offset] as const;
function run(world:Partial<ScmWorldCommands>,game=new ScmGameState(),...instructions:number[][]){
 const space=new Uint8Array(2048);space.set(instructions.flat(),CODE);
 const host:ScmThreadHost={startScript(){},game,world:{fade(){},...world} as ScmWorldCommands};
 const thread=new ScmThread(space,CODE,0,undefined,host);
 try{thread.run(0,40);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 const view=new DataView(space.buffer);
 return {thread,readInt:(offset:number)=>view.getInt32(offset,true),readFloat:(offset:number)=>view.getFloat32(offset,true)};
}
const PED=7,CAR=9,OBJECT=11;
const op=scmOpcode;

describe('the arithmetic the runtime does itself',()=>{
 test('the square root is written back as a float',()=>{
  expect(run({},undefined,instruction(op('SQRT'),[float(16),gvar(40)])).readFloat(40)).toBeCloseTo(4,5);
  expect(run({},undefined,instruction(op('SQRT'),[float(2),gvar(40)])).readFloat(40)).toBeCloseTo(Math.SQRT2,5);
 });

 test('a heading is measured from north and comes back between nothing and a full turn',()=>{
  const heading=(x:number,y:number)=>run({},undefined,
   instruction(op('GET_HEADING_FROM_VECTOR_2D'),[float(x),float(y),gvar(40)])).readFloat(40);
  expect(heading(0,1)).toBeCloseTo(0,4);
  expect(heading(-1,0)).toBeCloseTo(90,4);
  expect(heading(0,-1)).toBeCloseTo(180,4);
  expect(heading(1,0)).toBeCloseTo(270,4);
 });

 test('two rectangles collide when they overlap on both axes and not otherwise',()=>{
  const collide=(bx:number,by:number)=>run({},undefined,instruction(op('DO_2D_RECTANGLES_COLLIDE'),
   [float(0),float(0),float(10),float(10),float(bx),float(by),float(10),float(10)])).thread.condition;
  expect(collide(0,0)).toBe(true);
  expect(collide(9,0)).toBe(true);
  expect(collide(11,0)).toBe(false);
  expect(collide(0,11)).toBe(false);
  // Touching edges count as a collision, which the inclusive comparison gives.
  expect(collide(10,0)).toBe(true);
 });
});

describe('the groups, vehicles and particles of this batch',()=>{
 test('the group commands give back a handle and take it again',()=>{
  const calls:unknown[][]=[];
  const method=(name:string,result?:unknown)=>(...args:unknown[])=>{calls.push([name,...args]);return result;};
  const world={createGroup:method('create',5),removeGroup:method('remove'),
   setGroupFollowStatus:method('follow'),setGroupDecisionMaker:method('decision')} as unknown as Partial<ScmWorldCommands>;
  const {readInt}=run(world,undefined,
   instruction(op('CREATE_GROUP'),[int(2),gvar(40)]),
   instruction(op('SET_GROUP_FOLLOW_STATUS'),[int(5),int(1)]),
   instruction(op('SET_GROUP_DECISION_MAKER'),[int(5),int(12)]),
   instruction(op('REMOVE_GROUP'),[int(5)]));
  expect(readInt(40)).toBe(5);
  expect(calls).toEqual([['create',2],['follow',5,true],['decision',5,12],['remove',5]]);
 });

 test('the force on a car carries a direction and the offset it acts at',()=>{
  const calls:unknown[][]=[];
  run({applyForceToVehicle:(...args:unknown[])=>{calls.push(args);}},undefined,
   instruction(op('APPLY_FORCE_TO_CAR'),[int(CAR),float(0),float(10),float(0),float(0),float(-1),float(0)]));
  expect(calls).toEqual([[CAR,{x:0,y:10,z:0},{x:0,y:-1,z:0}]]);
 });

 test('the particle commands and the object animation pass what the script named',()=>{
  const calls:unknown[][]=[];
  const method=(name:string,result?:unknown)=>(...args:unknown[])=>{calls.push([name,...args]);return result;};
  const world={stopFxSystem:method('stop'),playAndKillFxSystem:method('playKill'),
   createFxSystemOnObject:method('onObject',9),playObjectAnim:method('anim')} as unknown as Partial<ScmWorldCommands>;
  const {readInt}=run(world,undefined,
   instruction(op('STOP_FX_SYSTEM'),[int(3)]),
   instruction(op('PLAY_AND_KILL_FX_SYSTEM'),[int(3)]),
   instruction(op('CREATE_FX_SYSTEM_ON_OBJECT'),['spark',int(OBJECT),float(0),float(0),float(1),int(0),gvar(40)]),
   instruction(op('PLAY_OBJECT_ANIM'),[int(OBJECT),'OPEN','GARAGE',float(1),int(0),int(1)]));
  expect(readInt(40)).toBe(9);
  expect(calls).toEqual([
   ['stop',3],['playKill',3],['onObject','spark',OBJECT,{x:0,y:0,z:1},false],
   ['anim',OBJECT,'OPEN','GARAGE',1,false,true],
  ]);
 });

 test('the remaining tasks carry their own operands',()=>{
  const tasks:ScmScriptedTask[]=[];
  run({givePedScriptedTask:(_ped:number,task:ScmScriptedTask)=>{tasks.push(task);}},undefined,
   instruction(op('TASK_LOOK_ABOUT'),[int(PED),int(3000)]),
   instruction(op('TASK_AIM_GUN_AT_COORD'),[int(PED),float(1),float(2),float(3),int(2000)]),
   instruction(op('TASK_AIM_GUN_AT_CHAR'),[int(PED),int(8),int(2000)]),
   instruction(op('TASK_SHOOT_AT_CHAR'),[int(PED),int(8),int(1500)]),
   instruction(op('TASK_LEAVE_CAR_IMMEDIATELY'),[int(PED),int(CAR)]),
   instruction(op('TASK_DIE_NAMED_ANIM'),[int(PED),'KO_SHOT','PED',float(4),int(-1)]));
  expect(tasks).toEqual([
   {kind:'lookAbout',time:3000},
   {kind:'aimGunAtCoord',x:1,y:2,z:3,time:2000},
   {kind:'aimGunAtPed',target:8,time:2000},
   {kind:'shootAtPed',target:8,time:1500},
   {kind:'leaveCarImmediately',vehicle:CAR},
   {kind:'dieNamedAnim',animationName:'KO_SHOT',animationFile:'PED',blendSpeed:4,time:-1},
  ]);
 });
});
