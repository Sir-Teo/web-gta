import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmScriptedTask,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {MAX_CHECKPOINTS,ScmCheckpoints} from '../src/engine/ScmCheckpoints';
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
 try{thread.run(0,32);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 const view=new DataView(space.buffer);
 return {thread,game,readInt:(offset:number)=>view.getInt32(offset,true)};
}
const PED=7,CAR=9,OBJECT=11;
const op=scmOpcode;

describe('the checkpoints a script places',()=>{
 test('a checkpoint keeps its type, both its points and its radius',()=>{
  const game=new ScmGameState();
  const {readInt}=run({},game,instruction(op('CREATE_CHECKPOINT'),
   [int(2),float(10),float(20),float(3),float(40),float(50),float(6),float(8),gvar(40)]));
  const handle=readInt(40);
  expect(game.checkpoints.at(handle)).toMatchObject({type:2,position:{x:10,y:20,z:3},pointAt:{x:40,y:50,z:6},radius:8});
  run({},game,instruction(op('DELETE_CHECKPOINT'),[int(handle)]));
  expect(game.checkpoints.count).toBe(0);
  // Deleting a handle that names nothing does nothing.
  run({},game,instruction(op('DELETE_CHECKPOINT'),[int(handle)]));
  expect(game.checkpoints.count).toBe(0);
 });

 test('the table holds thirty-two and refuses a thirty-third',()=>{
  const game=new ScmGameState();
  const point={x:0,y:0,z:0};
  for(let index=0;index<MAX_CHECKPOINTS;index++)game.checkpoints.create(1,point,point,5);
  expect(game.checkpoints.count).toBe(MAX_CHECKPOINTS);
  expect(()=>game.checkpoints.create(1,point,point,5)).toThrow(/slot/);
  expect(()=>game.checkpoints.at(MAX_CHECKPOINTS)).toThrow(/range/);
  expect(ScmCheckpoints.indexOf(game.checkpoints.all[0].index)).toBe(0);
 });
});

describe('the runtime’s own switches in this batch',()=>{
 test('the suppressed models, the gang switch and the mission respect are the runtime’s',()=>{
  const game=new ScmGameState();
  expect(game.playerGangVisible).toBe(true);
  run({},game,instruction(op('SUPPRESS_CAR_MODEL'),[int(411)]),
   instruction(op('MAKE_PLAYER_GANG_DISAPPEAR'),[]),
   instruction(op('AWARD_PLAYER_MISSION_RESPECT'),[int(15)]),
   instruction(op('AWARD_PLAYER_MISSION_RESPECT'),[int(5)]));
  expect([...game.suppressedCarModels]).toEqual([411]);
  expect(game.playerGangVisible).toBe(false);
  expect(game.missionRespect).toBe(20);
  run({},game,instruction(op('MAKE_PLAYER_GANG_REAPPEAR'),[]));
  expect(game.playerGangVisible).toBe(true);
 });
});

describe('the vehicle, ped and object commands of this batch',()=>{
 test('a car with nobody at the wheel leaves the variable at nothing',()=>{
  expect(run({vehicleDriver:()=>5},undefined,
   instruction(op('GET_DRIVER_OF_CAR'),[int(CAR),gvar(40)])).readInt(40)).toBe(5);
  expect(run({vehicleDriver:()=>undefined},undefined,
   instruction(op('GET_DRIVER_OF_CAR'),[int(CAR),gvar(40)])).readInt(40)).toBe(0);
 });

 test('the random model gives back the model and the class together',()=>{
  const asked:boolean[]=[];
  const {readInt}=run({randomVehicleModelInMemory:(normalOnly:boolean)=>{asked.push(normalOnly);return {model:411,vehicleClass:2};}},
   undefined,instruction(op('GET_RANDOM_CAR_MODEL_IN_MEMORY'),[int(1),gvar(40),gvar(44)]));
  expect(asked).toEqual([true]);
  expect([readInt(40),readInt(44)]).toEqual([411,2]);
 });

 test('the decision-maker response carries one chance for each way a ped may feel',()=>{
  const calls:unknown[]=[];
  run({addPedDecisionMakerEventResponse:(...args)=>{calls.push(args);}},undefined,
   instruction(op('ADD_CHAR_DECISION_MAKER_EVENT_RESPONSE'),
    [int(5),int(12),int(3),float(0.1),float(0.2),float(0.3),float(0.4),int(1),int(0)]));
  // The four chances are float32 in the script, so they come back near rather than exactly equal.
  const [decisionMaker,event,taskId,chances,inCar,onFoot]=calls[0] as [number,number,number,Record<string,number>,boolean,boolean];
  expect([decisionMaker,event,taskId,inCar,onFoot]).toEqual([5,12,3,true,false]);
  expect(chances.respect).toBeCloseTo(0.1,6);
  expect(chances.hate).toBeCloseTo(0.2,6);
  expect(chances.like).toBeCloseTo(0.3,6);
  expect(chances.dislike).toBeCloseTo(0.4,6);
 });

 test('the object slide carries a point and a speed of its own',()=>{
  const calls:unknown[]=[];
  run({slideObject:(...args)=>{calls.push(args);}},undefined,
   instruction(op('SLIDE_OBJECT'),[int(OBJECT),float(1),float(2),float(3),float(0.1),float(0.2),float(0.3),int(1)]));
  const [handle,position,speed,collisionCheck]=calls[0] as [number,Record<string,number>,Record<string,number>,boolean];
  expect([handle,position,collisionCheck]).toEqual([OBJECT,{x:1,y:2,z:3},true]);
  expect(speed.x).toBeCloseTo(0.1,6);
  expect(speed.y).toBeCloseTo(0.2,6);
  expect(speed.z).toBeCloseTo(0.3,6);
 });

 test('the HUD colour reads back its four channels',()=>{
  const {readInt}=run({hudColour:()=>({red:255,green:128,blue:64,alpha:200})},undefined,
   instruction(op('GET_HUD_COLOUR'),[int(3),gvar(40),gvar(44),gvar(48),gvar(52)]));
  expect([readInt(40),readInt(44),readInt(48),readInt(52)]).toEqual([255,128,64,200]);
 });

 test('the last tasks carry the operands the schema names',()=>{
  const tasks:ScmScriptedTask[]=[];
  run({givePedScriptedTask:(_ped:number,task:ScmScriptedTask)=>{tasks.push(task);}},undefined,
   instruction(op('TASK_CHAT_WITH_CHAR'),[int(PED),int(8),int(1),int(0)]),
   instruction(op('TASK_CAR_MISSION'),[int(PED),int(CAR),int(10),int(5),float(20),int(2)]),
   instruction(op('TASK_CAR_TEMP_ACTION'),[int(PED),int(CAR),int(7),int(1500)]),
   instruction(op('TASK_SMART_FLEE_CHAR'),[int(PED),int(8),float(50),int(4000)]),
   instruction(op('TASK_TURN_CHAR_TO_FACE_COORD'),[int(PED),float(1),float(2),float(3)]),
   instruction(op('TASK_DIE'),[int(PED)]));
  expect(tasks).toEqual([
   {kind:'chatWithPed',other:8,leadSpeaker:true,unknown:0},
   {kind:'carMission',vehicle:CAR,targetVehicle:10,missionId:5,cruiseSpeed:20,drivingStyle:2},
   {kind:'carTempAction',vehicle:CAR,actionId:7,time:1500},
   {kind:'smartFleePed',threat:8,radius:50,time:4000},
   {kind:'turnToFaceCoord',x:1,y:2,z:3},
   {kind:'die'},
  ]);
 });
});
