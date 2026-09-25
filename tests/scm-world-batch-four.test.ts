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
const lvar=(index:number)=>[3,index] as const;
function recording(){
 const calls:unknown[][]=[];const tasks:ScmScriptedTask[]=[];
 const method=(name:string,result?:unknown)=>(...args:unknown[])=>{calls.push([name,...args]);return result;};
 const world={
  givePedScriptedTask:(_ped:number,task:ScmScriptedTask)=>{tasks.push(task);},
  heliGotoCoords:method('heli'),setHeliBladesFullSpeed:method('blades'),
  setVehicleStraightLineDistance:method('straight'),setVehicleAreaVisible:method('area'),
  damageVehicleDoor:method('door'),vehicleWasDamagedByPed:method('damagedBy',true),
  setVehicleTempAction:method('temp'),vehicleHealth:method('health',1000),
  vehicleIsInWater:method('water',true),setVehicleVisible:method('visible'),setTrainSpeed:method('train'),
  vehiclePosition:()=>({x:5,y:5,z:0}),
  setPedCanBeKnockedOffBike:method('bike'),pedIsHoldingObject:method('holding',true),
  clearAllPedRelationships:method('relations'),objectIsAttached:method('attached',true),
  createFxSystemOnPed:method('fxOnPed',21),
  clearGroupDecisionMakerEventResponse:method('clearGroup'),copyPedDecisionMaker:method('copy',33),
  switchRandomTrains:method('trains'),
  setAllVehiclesCanBeDamaged:method('allDamage'),displayHud:method('hud'),
  
  addExplosionVariableShake:method('shake'),
  analogueSticks:method('sticks',{leftX:10,leftY:-20,rightX:30,rightY:-40}),
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

describe('the tasks of this batch',()=>{
 test('each carries the operands the schema names',()=>{
  const {world,tasks}=recording();
  run(world,undefined,
   instruction(op('TASK_TOGGLE_PED_THREAT_SCANNER'),[int(PED),int(1),int(0),int(1)]),
   instruction(op('TASK_DESTROY_CAR'),[int(PED),int(CAR)]),
   instruction(op('TASK_SHUFFLE_TO_NEXT_CAR_SEAT'),[int(PED),int(CAR)]),
   instruction(op('TASK_SCRATCH_HEAD'),[int(PED)]),
   instruction(op('TASK_WANDER_STANDARD'),[int(PED)]),
   instruction(op('TASK_CLIMB'),[int(PED),int(1)]),
   instruction(op('TASK_DUCK'),[int(PED),int(2000)]),
   instruction(op('TASK_SET_IGNORE_WEAPON_RANGE_FLAG'),[int(PED),int(1)]),
   instruction(op('TASK_LOOK_AT_COORD'),[int(PED),float(1),float(2),float(3),int(1500)]),
   instruction(op('TASK_KILL_CHAR_ON_FOOT_TIMED'),[int(PED),int(8),int(9000)]));
  expect(tasks).toEqual([
   {kind:'togglePedThreatScanner',onFoot:true,inCar:false,duringScriptTask:true},
   {kind:'destroyCar',vehicle:CAR},
   {kind:'shuffleToNextCarSeat',vehicle:CAR},
   {kind:'scratchHead'},
   {kind:'wanderStandard'},
   {kind:'climb',flag:true},
   {kind:'duck',time:2000},
   {kind:'setIgnoreWeaponRangeFlag',state:true},
   {kind:'lookAtCoord',x:1,y:2,z:3,time:1500},
   {kind:'killPedOnFootTimed',target:8,time:9000},
  ]);
 });
});

describe('the helicopters, vehicles and world switches',()=>{
 test('a helicopter is given a band of altitude rather than one height',()=>{
  const {world,calls}=recording();
  run(world,undefined,instruction(op('HELI_GOTO_COORDS'),[int(CAR),float(10),float(20),float(30),float(15),float(40)]),
   instruction(op('SET_HELI_BLADES_FULL_SPEED'),[int(CAR)]));
  expect(calls).toEqual([['heli',CAR,10,20,30,15,40],['blades',CAR]]);
 });

 test('the car health question compares with greater or equal, as the ped one does',()=>{
  const {world}=recording();
  expect(run(world,undefined,instruction(op('IS_CAR_HEALTH_GREATER'),[int(CAR),int(1000)])).thread.condition).toBe(true);
  expect(run(world,undefined,instruction(op('IS_CAR_HEALTH_GREATER'),[int(CAR),int(1001)])).thread.condition).toBe(false);
 });

 test('a car inside the box is located whichever way the corners come',()=>{
  const {world}=recording();
  expect(run(world,undefined,instruction(op('IS_CAR_IN_AREA_2D'),
   [int(CAR),float(0),float(0),float(10),float(10),int(0)])).thread.condition).toBe(true);
  expect(run(world,undefined,instruction(op('IS_CAR_IN_AREA_2D'),
   [int(CAR),float(10),float(10),float(0),float(0),int(0)])).thread.condition).toBe(true);
  expect(run(world,undefined,instruction(op('IS_CAR_IN_AREA_2D'),
   [int(CAR),float(20),float(20),float(30),float(30),int(0)])).thread.condition).toBe(false);
 });

 test('the world switches and the pad sticks reach the host',()=>{
  const {world,calls}=recording();
  const {readInt}=run(world,undefined,
   instruction(op('SWITCH_RANDOM_TRAINS'),[int(1)]),
   instruction(op('SET_ALL_CARS_CAN_BE_DAMAGED'),[int(0)]),
   instruction(op('DISPLAY_HUD'),[int(1)]),
   instruction(op('ADD_EXPLOSION_VARIABLE_SHAKE'),[float(1),float(2),float(3),int(4),float(0.5)]),
   instruction(op('GET_POSITION_OF_ANALOGUE_STICKS'),[int(0),gvar(40),gvar(44),gvar(48),gvar(52)]));
  expect(calls).toEqual([
   ['trains',true],['allDamage',false],['hud',true],
   ['shake',1,2,3,4,0.5],['sticks',0],
  ]);
  expect([readInt(40),readInt(44),readInt(48),readInt(52)]).toEqual([10,-20,30,-40]);
 });

 test('the particle on a ped and the copied decision maker give back handles',()=>{
  const {world,calls}=recording();
  const fx=run(world,undefined,instruction(op('CREATE_FX_SYSTEM_ON_CHAR'),
   ['smoke',int(PED),float(0),float(0),float(1),int(1),gvar(40)]));
  expect(fx.readInt(40)).toBe(21);
  const copy=run(world,undefined,instruction(op('COPY_CHAR_DECISION_MAKER'),[int(5),gvar(40)]));
  expect(copy.readInt(40)).toBe(33);
  expect(calls[0]).toEqual(['fxOnPed','smoke',PED,{x:0,y:0,z:1},true]);
 });

 test('the late comparison matches its twin, and reads a local against a global',()=>{
  const game=new ScmGameState();
  const space=new Uint8Array(2048);
  const view=new DataView(space.buffer);
  view.setInt32(40,7,true);
  space.set([...instruction(scmOpcode('SET_LVAR_INT'),[lvar(4),int(7)]),
   ...instruction(op('IS_INT_LVAR_EQUAL_TO_INT_VAR'),[lvar(4),gvar(40)])],CODE);
  const host:ScmThreadHost={startScript(){},game,world:{fade(){}} as ScmWorldCommands};
  const thread=new ScmThread(space,CODE,0,undefined,host);
  try{thread.run(0,8);}catch(error){if(!String(error).includes('watchdog'))throw error;}
  expect(thread.condition).toBe(true);
 });
});
