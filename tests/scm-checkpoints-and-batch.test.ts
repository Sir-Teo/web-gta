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
 test('a car with nobody at the wheel gives -1, which names no ped (0 is a live pool slot)',()=>{
  expect(run({vehicleDriver:()=>5},undefined,
   instruction(op('GET_DRIVER_OF_CAR'),[int(CAR),gvar(40)])).readInt(40)).toBe(5);
  expect(run({vehicleDriver:()=>undefined},undefined,
   instruction(op('GET_DRIVER_OF_CAR'),[int(CAR),gvar(40)])).readInt(40)).toBe(-1);
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

 test('an object slides toward its target a timestep at a time, stopping there, and says when it has arrived',()=>{
  const game=new ScmGameState(),handle=game.objects.create(1337,{x:0,y:0,z:0},{external:false,missionCleanup:false}).handle;
  const slide=(timeStep:number,world:Partial<ScmWorldCommands>={})=>{
   const space=new Uint8Array(2048),view=new DataView(space.buffer);view.setInt32(40,0,true);
   space.set([...instruction(op('SLIDE_OBJECT'),[int(handle),float(1),float(-2),float(0),float(0.25),float(0.5),float(0),int(world.objectBlockedAt?1:0)]),
    ...instruction(op('GOTO_IF_FALSE'),[int(CODE+64)]),...instruction(op('SET_VAR_INT'),[gvar(40),int(1)])],CODE);
   const thread=new ScmThread(space,CODE,0,undefined,{startScript(){},game,world:{fade(){},...world} as ScmWorldCommands});
   try{thread.run(0,4,timeStep);}catch(error){if(!String(error).match(/watchdog|opcode|Unknown/))throw error;}
   return view.getInt32(40,true)===1;
  };
  // 0.25 and 0.5 units a frame at a timestep of 1: a quarter of the way along x, and half way along y.
  expect(slide(1)).toBe(false);expect(game.objects.at(handle).position).toEqual({x:0.25,y:-0.5,z:0});
  // A blocked move is not made, and the iOS handler then sets the flag as if the object had arrived.
  expect(slide(1,{objectBlockedAt:()=>true})).toBe(true);expect(game.objects.at(handle).position).toEqual({x:0.25,y:-0.5,z:0});
  // It stops at the target on each axis, and says so once all three are there.
  expect(slide(10)).toBe(true);expect(game.objects.at(handle).position).toEqual({x:1,y:-2,z:0});
 });

 test('SET_OBJECT_COORDINATES_AND_VELOCITY puts the object at the point with the speed that took it there this frame',()=>{
  const game=new ScmGameState(),handle=game.objects.create(1337,{x:1,y:2,z:3},{external:false,missionCleanup:false}).handle;
  const space=new Uint8Array(2048);
  space.set(instruction(op('SET_OBJECT_COORDINATES_AND_VELOCITY'),[int(handle),float(2),float(2),float(2.5)]),CODE);
  const thread=new ScmThread(space,CODE,0,undefined,{startScript(){},game,world:{fade(){}} as unknown as ScmWorldCommands});
  try{thread.run(0,1,.5);}catch(error){if(!String(error).match(/watchdog|opcode|Unknown/))throw error;}
  expect(game.objects.at(handle).position).toEqual({x:2,y:2,z:2.5});
  // A unit east and half down over half a frame: two units and one down a frame, each held to ±1 (iOS 0x1001fbeec).
  expect(game.objects.at(handle).velocity).toEqual({x:1,y:0,z:-1});
 });
 test('ROTATE_OBJECT steps the heading the shorter way to the target and flags the arrival (iOS 0x1001d75e8)',()=>{
  const game=new ScmGameState(),handle=game.objects.create(1337,{x:0,y:0,z:0},{external:false,missionCleanup:false}).handle;
  game.objects.setHeading(handle,80);
  const rotate=(target:number,step:number)=>{const {thread}=run({},game,instruction(op('ROTATE_OBJECT'),[int(handle),float(target),float(step),int(0)]));
   return {heading:game.objects.getHeading(handle),done:(thread as unknown as {condition:boolean}).condition};};
  // Up from 80 toward 90 by 2 a call, snapping once less than a step is left.
  expect(rotate(90,2)).toMatchObject({done:false});expect(game.objects.getHeading(handle)).toBeCloseTo(82,4);
  for(let k=0;k<3;k++)rotate(90,2);expect(game.objects.getHeading(handle)).toBeCloseTo(88,4);
  // The call that lands on it is the arrival, and one already there says so too.
  expect(rotate(90,2).done).toBe(true);expect(game.objects.getHeading(handle)).toBeCloseTo(90,4);
  expect(rotate(90,2).done).toBe(true);
  // Less than a step left snaps to the target.
  game.objects.setHeading(handle,89);expect(rotate(90,2).done).toBe(true);expect(game.objects.getHeading(handle)).toBeCloseTo(90,4);
  // The shorter way round: from 90 to 0 goes down; to 300 goes down through 0 too.
  rotate(0,10);expect(game.objects.getHeading(handle)).toBeCloseTo(80,4);
  game.objects.setHeading(handle,10);rotate(300,30);expect(game.objects.getHeading(handle)).toBeCloseTo(340,4);
  // A step of 360 gets there at once.
  expect(rotate(180,360).done).toBe(true);expect(game.objects.getHeading(handle)).toBeCloseTo(180,4);
 });
 test('SET_OBJECT_COORDINATES_AND_VELOCITY puts a z at or below -100 on the ground',()=>{
  const game=new ScmGameState(),handle=game.objects.create(1337,{x:1,y:2,z:3},{external:false,missionCleanup:false}).handle;
  const space=new Uint8Array(2048);
  space.set(instruction(op('SET_OBJECT_COORDINATES_AND_VELOCITY'),[int(handle),float(1.5),float(2),float(-100)]),CODE);
  const thread=new ScmThread(space,CODE,0,undefined,{startScript(){},game,world:{fade(){},groundZForCoord:()=>3.1} as unknown as ScmWorldCommands});
  try{thread.run(0,1,1);}catch(error){if(!String(error).match(/watchdog|opcode|Unknown/))throw error;}
  expect(game.objects.at(handle).position).toEqual({x:1.5,y:2,z:3.1});
 });

 test('an object’s model is its number, or the script’s own used-object id for a named one',()=>{
  const game=new ScmGameState();
  const numbered=game.objects.create(1337,{x:0,y:0,z:0},{external:false,missionCleanup:false}).handle;
  const named=game.objects.create('barrel4',{x:0,y:0,z:0},{external:false,missionCleanup:false}).handle;
  const read=(handle:number)=>{
   const space=new Uint8Array(2048);space.set(instruction(op('GET_OBJECT_MODEL'),[int(handle),gvar(40)]),CODE);
   const thread=new ScmThread(space,CODE,0,undefined,{startScript(){},game,world:{fade(){}} as ScmWorldCommands,objectNames:['','kmb_rocks','barrel4']});
   try{thread.run(0,1);}catch(error){if(!String(error).match(/watchdog|opcode|Unknown/))throw error;}
   return new DataView(space.buffer).getInt32(40,true);
  };
  expect(read(numbered)).toBe(1337);
  expect(read(named)).toBe(-2);
 });

 test('SET_NEXT_DESIRED_MOVE_STATE is taken by the next enter-car task, and the one after runs',()=>{
  const tasks:ScmScriptedTask[]=[];
  run({givePedScriptedTask:(_ped:number,task:ScmScriptedTask)=>{tasks.push(task);}},undefined,
   instruction(op('SET_NEXT_DESIRED_MOVE_STATE'),[int(4)]),
   instruction(op('TASK_ENTER_CAR_AS_PASSENGER'),[int(PED),int(CAR),int(10000),int(0)]),
   instruction(op('TASK_ENTER_CAR_AS_DRIVER'),[int(PED),int(CAR),int(10000)]));
  expect(tasks.map(t=>'moveState' in t?t.moveState:undefined)).toEqual([4,6]);
 });

 test('SET_NEAR_CLIP and DISPLAY_HUD are the runtime’s own camera and HUD state',()=>{
  const game=new ScmGameState();
  run({},game,instruction(op('SET_NEAR_CLIP'),[float(.25)]),instruction(op('DISPLAY_HUD'),[int(0)]));
  expect(game.camera.useNearClipScript).toBe(true);expect(game.camera.nearClipScript).toBeCloseTo(.25,6);
  expect(game.displayHud).toBe(false);
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
