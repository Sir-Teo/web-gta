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
function recording(){
 const calls:unknown[][]=[];
 const tasks:ScmScriptedTask[]=[];
 const method=(name:string,result?:unknown)=>(...args:unknown[])=>{calls.push([name,...args]);return result;};
 const world={
  givePedScriptedTask:(_ped:number,task:ScmScriptedTask)=>{tasks.push(task);},
  switchVehicleSiren:method('siren'),vehicleGotoCoordinates:method('goto'),setVehicleHeavy:method('heavy'),
  setVehiclePetrolTankWeakpoint:method('petrol'),setVehicleStatus:method('status'),
  setVehicleRotationVelocity:method('spin'),freezeVehiclePositionAndDontLoadCollision:method('freeze'),
  openVehicleDoor:method('door'),setVehicleIdle:method('idle'),setTrainCruiseSpeed:method('train'),
  setObjectVisible:method('visible'),setObjectOnlyDamagedByPlayer:method('onlyPlayer'),
  makeObjectTargettable:method('targettable'),breakObject:method('break'),
  objectHasBeenDamaged:method('damaged',true),
  closestObjectOfTypeIsSmashedOrDamaged:method('closest',true),
  createFxSystem:method('fx',17),setPedIsTargetPriority:method('priority'),
  setScriptLimitToGangSize:method('gangLimit'),makeRoomInPlayerGangForMissionPeds:method('room'),
  flushPatrolRoute:method('flushPatrol'),markRoadNodeAsDontWander:method('dontWander'),
  setRadioChannel:method('radio'),setNearClip:method('clip'),
  setTimeScale:method('timeScale'),displayOnscreenCounterWithString:method('counter'),
 } as unknown as Partial<ScmWorldCommands>;
 return {world,calls,tasks};
}
function run(world:Partial<ScmWorldCommands>,game=new ScmGameState(),...instructions:number[][]){
 const space=new Uint8Array(2048);space.set(instructions.flat(),CODE);
 const host:ScmThreadHost={startScript(){},game,world:{fade(){},...world} as ScmWorldCommands};
 const thread=new ScmThread(space,CODE,0,undefined,host);
 try{thread.run(0,40);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 const view=new DataView(space.buffer);
 return {thread,game,readInt:(offset:number)=>view.getInt32(offset,true)};
}
const PED=7,CAR=9,OBJECT=11;
const op=scmOpcode;

describe('the last of the tasks',()=>{
 test('each carries the operands the schema names',()=>{
  const {world,tasks}=recording();
  run(world,undefined,
   instruction(op('TASK_KINDA_STAY_IN_SAME_PLACE'),[int(PED),int(1)]),
   instruction(op('TASK_USE_MOBILE_PHONE'),[int(PED),int(1)]),
   instruction(op('TASK_FOLLOW_PATROL_ROUTE'),[int(PED),int(2),int(1)]),
   instruction(op('TASK_GOTO_CHAR'),[int(PED),int(8),int(4000),float(3)]),
   instruction(op('TASK_CAR_DRIVE_WANDER'),[int(PED),int(CAR),float(20),int(2)]),
   instruction(op('TASK_GO_TO_COORD_WHILE_SHOOTING'),[int(PED),float(1),float(2),float(3),int(2),float(5),float(1),int(8)]));
  expect(tasks).toEqual([
   {kind:'kindaStayInSamePlace',state:true},
   {kind:'useMobilePhone',start:true},
   {kind:'followPatrolRoute',speed:2,mode:1},
   {kind:'gotoPed',target:8,time:4000,radius:3},
   {kind:'carDriveWander',vehicle:CAR,speed:20,drivingMode:2},
   {kind:'goToCoordWhileShooting',x:1,y:2,z:3,speed:2,turnRadius:5,stopRadius:1,target:8},
  ]);
 });

 test('the pick-up task carries its offset, bone, orientation and animation',()=>{
  const {world,tasks}=recording();
  run(world,undefined,instruction(op('TASK_PICK_UP_OBJECT'),
   [int(PED),int(OBJECT),float(0),float(0.2),float(0),int(24),int(1),'CARRY','CARRY',int(-1)]));
  expect(tasks[0]).toMatchObject({kind:'pickUpObject',object:OBJECT,bone:24,orientation:1,
   animationName:'CARRY',animationFile:'CARRY',time:-1});
 });
});

describe('the vehicle, object and world commands of this batch',()=>{
 test('each passes its own operands',()=>{
  const {world,calls}=recording();
  run(world,undefined,
   instruction(op('SWITCH_CAR_SIREN'),[int(CAR),int(1)]),
   instruction(op('CAR_GOTO_COORDINATES'),[int(CAR),float(10),float(20),float(3)]),
   instruction(op('SET_CAR_HEAVY'),[int(CAR),int(1)]),
   instruction(op('SET_CAR_STATUS'),[int(CAR),int(4)]),
   instruction(op('SET_CAR_ROTATION_VELOCITY'),[int(CAR),float(0),float(1),float(0)]),
   instruction(op('OPEN_CAR_DOOR'),[int(CAR),int(2)]),
   instruction(op('CAR_SET_IDLE'),[int(CAR)]),
   instruction(op('SET_TRAIN_CRUISE_SPEED'),[int(CAR),float(15)]));
  expect(calls).toEqual([
   ['siren',CAR,true],['goto',CAR,10,20,3],['heavy',CAR,true],['status',CAR,4],
   ['spin',CAR,0,1,0],['door',CAR,2],['idle',CAR],['train',CAR,15],
  ]);
 });

 test('the object commands and the two damage questions',()=>{
  const {world,calls}=recording();
  const {thread}=run(world,undefined,
   instruction(op('SET_OBJECT_VISIBLE'),[int(OBJECT),int(0)]),
   instruction(op('MAKE_OBJECT_TARGETTABLE'),[int(OBJECT),int(1)]),
   instruction(op('BREAK_OBJECT'),[int(OBJECT),int(100)]),
   instruction(op('HAS_OBJECT_BEEN_DAMAGED'),[int(OBJECT)]),
   instruction(op('IS_CLOSEST_OBJECT_OF_TYPE_SMASHED_OR_DAMAGED'),
    [float(1),float(2),float(3),float(5),int(1234),int(1),int(0)]));
  expect(calls).toEqual([
   ['visible',OBJECT,false],['targettable',OBJECT,true],['break',OBJECT,100],
   ['damaged',OBJECT],['closest',1,2,3,5,1234,true,false],
  ]);
  expect(thread.condition).toBe(true);
 });

 test('an object is located inside the box around a point, in all three axes',()=>{
  const game=new ScmGameState();
  const handle=game.objects.create(1234,{x:10,y:20,z:5},{external:false,missionCleanup:false}).handle;
  const locate=(z:number)=>{
   const near=new ScmGameState();
   const other=near.objects.create(1234,{x:10,y:20,z},{external:false,missionCleanup:false}).handle;
   return run({},near,instruction(op('LOCATE_OBJECT_3D'),
    [int(other),float(10),float(20),float(5),float(2),float(2),float(2),int(0)])).thread.condition;
  };
  expect(run({},game,instruction(op('LOCATE_OBJECT_3D'),
   [int(handle),float(10),float(20),float(5),float(2),float(2),float(2),int(0)])).thread.condition).toBe(true);
  expect(locate(50)).toBe(false);
 });

 test('the world settings and the particle creation reach the host',()=>{
  const {world,calls}=recording();
  const {readInt}=run(world,undefined,
   instruction(op('CREATE_FX_SYSTEM'),['smoke',float(1),float(2),float(3),int(1),gvar(40)]),
   instruction(op('SET_RADIO_CHANNEL'),[int(3)]),
   instruction(op('SET_NEAR_CLIP'),[float(0.5)]),
   instruction(op('SET_TIME_SCALE'),[float(0.25)]),
   instruction(op('FLUSH_PATROL_ROUTE'),[]),
   instruction(op('MARK_ROAD_NODE_AS_DONT_WANDER'),[float(7),float(8),float(9)]),
   instruction(op('SET_SCRIPT_LIMIT_TO_GANG_SIZE'),[int(4)]),
   instruction(op('DISPLAY_ONSCREEN_COUNTER_WITH_STRING'),[int(1),int(0),'COUNT']));
  expect(readInt(40)).toBe(17);
  expect(calls).toEqual([
   ['fx','smoke',1,2,3,true],['radio',3],['clip',0.5],['timeScale',0.25],
   ['flushPatrol'],['dontWander',7,8,9],['gangLimit',4],['counter',1,0,'COUNT'],
  ]);
 });
});
