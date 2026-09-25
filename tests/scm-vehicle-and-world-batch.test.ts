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
function recording(){
 const calls:unknown[][]=[];
 const method=(name:string,result?:unknown)=>(...args:unknown[])=>{calls.push([name,...args]);return result;};
 const tasks:{ped:number;task:ScmScriptedTask}[]=[];
 const world={
  givePedScriptedTask:(ped:number,task:ScmScriptedTask)=>{tasks.push({ped,task});},
  setVehicleForwardSpeed:method('forward'),setVehicleCruiseSpeed:method('cruise'),
  changeVehicleColour:method('colour'),setVehicleLoadCollisionFlag:method('loadCollision'),
  setVehicleOnlyDamagedByPlayer:method('onlyPlayer'),setVehicleCanBurstTyres:method('burst'),
  attachObjectToVehicle:method('attach'),killFxSystem:method('killFx'),addExplosion:method('explode'),
  startPedFacialTalk:method('startTalk'),stopPedFacialTalk:method('stopTalk'),
  hidePedWeaponForScriptedCutscene:method('hideWeapon'),setGroupMember:method('group'),
  setPedHasUsedEntryExit:method('entryExit'),clearPedDecisionMakerEventResponse:method('clearResponse'),
  extendPatrolRoute:method('patrol'),playMissionPassedTune:method('tune'),
  isMessageBeingDisplayed:method('message',true),isHelpMessageBeingDisplayed:method('help',false),
 } as unknown as Partial<ScmWorldCommands>;
 return {world,calls,tasks};
}
function run(world:Partial<ScmWorldCommands>,game=new ScmGameState(),...instructions:number[][]){
 const space=new Uint8Array(2048);space.set(instructions.flat(),CODE);
 const host:ScmThreadHost={startScript(){},game,world:{fade(){},...world} as ScmWorldCommands};
 const thread=new ScmThread(space,CODE,0,undefined,host);
 try{thread.run(0,32);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 const view=new DataView(space.buffer);
 return {thread,game,readFloat:(offset:number)=>view.getFloat32(offset,true)};
}
const PED=7,CAR=9,OBJECT=11;
const op=scmOpcode;

describe('the remaining tasks',()=>{
 test('each carries the operands the schema names for it',()=>{
  const {world,tasks}=recording();
  run(world,undefined,
   instruction(op('TASK_FOLLOW_POINT_ROUTE'),[int(PED),int(2),int(1)]),
   instruction(op('TASK_GO_TO_COORD_ANY_MEANS'),[int(PED),float(1),float(2),float(3),int(2),int(CAR)]),
   instruction(op('TASK_ENTER_CAR_AS_DRIVER'),[int(PED),int(CAR),int(5000)]),
   instruction(op('TASK_ENTER_CAR_AS_PASSENGER'),[int(PED),int(CAR),int(5000),int(2)]),
   instruction(op('TASK_LEAVE_CAR'),[int(PED),int(CAR)]),
   instruction(op('TASK_STAND_STILL'),[int(PED),int(1000)]),
   instruction(op('TASK_SHOOT_AT_COORD'),[int(PED),float(4),float(5),float(6),int(2000)]),
   instruction(op('TASK_SET_CHAR_DECISION_MAKER'),[int(PED),int(12)]));
  expect(tasks.map(entry=>entry.task)).toEqual([
   {kind:'followPointRoute',speed:2,mode:1,route:[]},
   {kind:'goToCoordAnyMeans',x:1,y:2,z:3,speed:2,vehicle:CAR},
   {kind:'enterCarAsDriver',vehicle:CAR,time:5000},
   {kind:'enterCarAsPassenger',vehicle:CAR,time:5000,seat:2},
   {kind:'leaveCar',vehicle:CAR},
   {kind:'standStill',time:1000},
   {kind:'shootAtCoord',x:4,y:5,z:6,time:2000},
   {kind:'setDecisionMaker',decisionMaker:12},
  ]);
 });
});

describe('the vehicle setters and the world commands',()=>{
 test('each passes its own operands in the order the schema lists',()=>{
  const {world,calls}=recording();
  const {thread}=run(world,undefined,
   instruction(op('SET_CAR_FORWARD_SPEED'),[int(CAR),float(30)]),
   instruction(op('SET_CAR_CRUISE_SPEED'),[int(CAR),float(18)]),
   instruction(op('CHANGE_CAR_COLOUR'),[int(CAR),int(1),int(2)]),
   instruction(op('SET_LOAD_COLLISION_FOR_CAR_FLAG'),[int(CAR),int(1)]),
   instruction(op('SET_CAR_ONLY_DAMAGED_BY_PLAYER'),[int(CAR),int(1)]),
   instruction(op('SET_CAN_BURST_CAR_TYRES'),[int(CAR),int(0)]),
   instruction(op('ATTACH_OBJECT_TO_CAR'),[int(OBJECT),int(CAR),float(0),float(1),float(2),float(10),float(20),float(30)]),
   instruction(op('KILL_FX_SYSTEM'),[int(3)]),
   instruction(op('ADD_EXPLOSION'),[float(100),float(200),float(5),int(4)]),
   instruction(op('IS_MESSAGE_BEING_DISPLAYED'),[]));
  expect(calls).toEqual([
   ['forward',CAR,30],['cruise',CAR,18],['colour',CAR,1,2],['loadCollision',CAR,true],
   ['onlyPlayer',CAR,true],['burst',CAR,false],
   ['attach',OBJECT,CAR,{x:0,y:1,z:2},{x:10,y:20,z:30}],
   ['killFx',3],['explode',100,200,5,4],['message'],
  ]);
  expect(thread.condition).toBe(true);
 });

 test('the ped face, the group and the patrol route reach the host',()=>{
  const {world,calls}=recording();
  run(world,undefined,
   instruction(op('START_CHAR_FACIAL_TALK'),[int(PED),int(3000)]),
   instruction(op('STOP_CHAR_FACIAL_TALK'),[int(PED)]),
   instruction(op('HIDE_CHAR_WEAPON_FOR_SCRIPTED_CUTSCENE'),[int(PED),int(1)]),
   instruction(op('SET_GROUP_MEMBER'),[int(3),int(PED)]),
   instruction(op('SET_CHAR_HAS_USED_ENTRY_EXIT'),[int(PED),float(10),float(20),float(3)]),
   instruction(op('CLEAR_CHAR_DECISION_MAKER_EVENT_RESPONSE'),[int(5),int(12)]),
   instruction(op('EXTEND_PATROL_ROUTE'),[float(1),float(2),float(3),'IDLE','PED']),
   instruction(op('PLAY_MISSION_PASSED_TUNE'),[int(1)]));
  expect(calls).toEqual([
   ['startTalk',PED,3000],['stopTalk',PED],['hideWeapon',PED,true],['group',3,PED],
   ['entryExit',PED,10,20,3],['clearResponse',5,12],['patrol',1,2,3,'IDLE','PED'],['tune',1],
  ]);
 });

 test('the wanted multiplier and the special-character question are the runtime’s own',()=>{
  const game=new ScmGameState();
  expect(game.wantedMultiplier).toBe(1);
  run({},game,instruction(op('SET_WANTED_MULTIPLIER'),[float(2.5)]));
  expect(game.wantedMultiplier).toBeCloseTo(2.5,5);
  expect(run({},game,instruction(op('HAS_SPECIAL_CHARACTER_LOADED'),[int(1)])).thread.condition).toBe(false);
  game.specialCharacters.load(1,'CJ');
  expect(run({},game,instruction(op('HAS_SPECIAL_CHARACTER_LOADED'),[int(1)])).thread.condition).toBe(true);
 });

 test('the death-arrest question answers for the thread that asks it',()=>{
  const space=new Uint8Array(1024);space.set(instruction(op('HAS_DEATHARREST_BEEN_EXECUTED'),[]),0);
  const host:ScmThreadHost={startScript(){},game:new ScmGameState(),world:{fade(){}} as ScmWorldCommands};
  const thread=new ScmThread(space,0,0,undefined,host);
  try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
  expect(thread.condition).toBe(false);
  thread.doneDeathArrest=true;
  const again=new ScmThread(space,0,0,undefined,host);
  again.doneDeathArrest=true;
  try{again.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
  expect(again.condition).toBe(true);
 });
});
