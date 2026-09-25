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
 const calls:unknown[][]=[];const tasks:ScmScriptedTask[]=[];
 const method=(name:string,result?:unknown)=>(...args:unknown[])=>{calls.push([name,...args]);return result;};
 const world={
  givePedScriptedTask:(_ped:number,task:ScmScriptedTask)=>{tasks.push(task);},
  createSearchlight:method('light',4),deleteSearchlight:method('deleteLight'),
  searchlightExists:method('lightExists',true),attachSearchlightToObject:method('attachLight'),
  createMenu:method('menu',6),deleteMenu:method('deleteMenu'),setMenuColumn:method('column'),
  setMenuItemWithNumber:method('item'),
  objectHealth:method('objectHealth',400),objectLastWeaponDamage:method('objectDamaged',31),
  detachObject:method('detach'),grabEntityOnRopeForObject:method('grab',{vehicle:1,ped:2,object:3}),
  vehiclePassengerSeatIsFree:method('seatFree',true),setVehicleMission:method('mission'),
  controlVehicleHydraulics:method('hydraulics'),vehicleTyreIsBurst:method('burst',true),
  vehicleMaximumPassengers:method('maxPassengers',3),vehicleModelIs:method('modelIs',true),
  planeGotoCoords:method('plane'),vehicleIsStopped:method('stopped',true),
  vehiclePosition:()=>({x:1,y:1,z:1}),
  setGroupLeader:method('leader'),addGroupDecisionMakerEventResponse:method('groupResponse'),
  addSparks:method('sparks'),
  percentageTaggedInArea:method('tagged',42),clearAreaOfVehicles:method('clearCars'),
  drawLine:method('line'),clearSkip:method('clearSkip'),
 } as unknown as Partial<ScmWorldCommands>;
 return {world,calls,tasks};
}
function run(world:Partial<ScmWorldCommands>,...instructions:number[][]){
 const space=new Uint8Array(4096);space.set(instructions.flat(),CODE);
 const host:ScmThreadHost={startScript(){},game:new ScmGameState(),world:{fade(){},...world} as ScmWorldCommands};
 const thread=new ScmThread(space,CODE,0,undefined,host);
 try{thread.run(0,40);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 const view=new DataView(space.buffer);
 return {thread,game:host.game!,readInt:(offset:number)=>view.getInt32(offset,true)};
}
const PED=7,CAR=9,OBJECT=11;
const op=scmOpcode;

describe('the searchlights and the menus',()=>{
 test('a searchlight takes a point, the point it sweeps to and two radii',()=>{
  const {world,calls}=recording();
  const {readInt}=run(world,instruction(op('CREATE_SEARCHLIGHT'),
   [float(1),float(2),float(3),float(10),float(20),float(30),float(5),float(9),gvar(40)]));
  expect(readInt(40)).toBe(4);
  expect(calls[0]).toEqual(['light',{x:1,y:2,z:3},{x:10,y:20,z:30},5,9]);
 });

 test('a searchlight hangs on three objects at once',()=>{
  const {world,calls}=recording();
  run(world,instruction(op('ATTACH_SEARCHLIGHT_TO_SEARCHLIGHT_OBJECT'),
   [int(4),int(11),int(12),int(13),float(0),float(0),float(2)]));
  expect(calls).toEqual([['attachLight',4,11,12,13,{x:0,y:0,z:2}]]);
 });

 test('a menu column names a title and twelve rows',()=>{
  const {world,calls}=recording();
  const rows=Array.from({length:12},(_value,index)=>`ROW${index}`);
  run(world,instruction(op('SET_MENU_COLUMN'),[int(6),int(0),'TITLE',...rows]));
  expect(calls).toEqual([['column',6,0,'TITLE',rows]]);
 });

 test('a menu is created with its box and alignment, and deleted by handle',()=>{
  const {world,calls}=recording();
  const {readInt}=run(world,instruction(op('CREATE_MENU'),
   ['HEADER',float(10),float(20),float(200),int(2),int(1),int(1),int(0),gvar(40)]),
   instruction(op('DELETE_MENU'),[int(6)]));
  expect(readInt(40)).toBe(6);
  expect(calls).toEqual([['menu','HEADER',10,20,200,2,true,true,0],['deleteMenu',6]]);
 });
});

describe('the objects, vehicles and world of this batch',()=>{
 test('the rope grab gives back three handles at once',()=>{
  const {world}=recording();
  const {readInt}=run(world,instruction(op('GRAB_ENTITY_ON_ROPE_FOR_OBJECT'),
   [int(OBJECT),gvar(40),gvar(44),gvar(48)]));
  expect([readInt(40),readInt(44),readInt(48)]).toEqual([1,2,3]);
 });

 test('a stopped car inside the box is located, and a moving one is not',()=>{
  const {world}=recording();
  const operands=[int(CAR),float(1),float(1),float(1),float(5),float(5),float(5),int(0)] as const;
  expect(run(world,instruction(op('LOCATE_STOPPED_CAR_3D'),operands)).thread.condition).toBe(true);
  const moving={...world,vehicleIsStopped:()=>false};
  expect(run(moving,instruction(op('LOCATE_STOPPED_CAR_3D'),operands)).thread.condition).toBe(false);
 });

 test('the hydraulics take one suspension height for each wheel',()=>{
  const {world,calls}=recording();
  run(world,instruction(op('CONTROL_CAR_HYDRAULICS'),
   [int(CAR),float(0.1),float(0.2),float(0.3),float(0.4)]));
  const [name,handle,...heights]=calls[0] as [string,number,number,number,number,number];
  expect([name,handle]).toEqual(['hydraulics',CAR]);
  expect(heights[0]).toBeCloseTo(0.1,6);
  expect(heights[3]).toBeCloseTo(0.4,6);
 });

 test('the remaining world commands pass their own operands',()=>{
  const {world,calls}=recording();
  const {readInt}=run(world,
   instruction(op('ADD_SPARKS'),[float(1),float(2),float(3),float(0),float(0),float(1),int(20)]),
   instruction(op('GET_PERCENTAGE_TAGGED_IN_AREA'),[float(0),float(0),float(10),float(10),gvar(40)]),
   instruction(op('CLEAR_AREA_OF_CARS'),[float(0),float(0),float(0),float(10),float(10),float(10)]),
   instruction(op('LINE'),[float(0),float(0),float(0),float(1),float(1),float(1)]),
   instruction(op('CLEAR_SKIP'),[]));
  expect(readInt(40)).toBe(42);
  expect(calls).toEqual([
   ['sparks',{x:1,y:2,z:3},{x:0,y:0,z:1},20],['tagged',0,0,10,10],
   ['clearCars',{x:0,y:0,z:0},{x:10,y:10,z:10}],['line',{x:0,y:0,z:0},{x:1,y:1,z:1}],
   ['clearSkip'],
  ]);
 });

 test('the tasks of this batch carry their own operands',()=>{
  const {world,tasks}=recording();
  run(world,
   instruction(op('TASK_FLEE_CHAR'),[int(PED),int(8),float(40),int(5000)]),
   instruction(op('TASK_FLEE_POINT'),[int(PED),float(1),float(2),float(3),float(30),int(4000)]),
   instruction(op('TASK_HANDS_UP'),[int(PED),int(2000)]),
   instruction(op('TASK_JUMP'),[int(PED),int(1)]),
   instruction(op('TASK_SIT_DOWN'),[int(PED),int(3000)]));
  expect(tasks).toEqual([
   {kind:'fleePed',threat:8,radius:40,time:5000},
   {kind:'fleePoint',x:1,y:2,z:3,radius:30,time:4000},
   {kind:'handsUp',time:2000},
   {kind:'jump',state:true},
   {kind:'sitDown',time:3000},
  ]);
 });

 test('the slide-and-play task carries a whole animation beside its point',()=>{
  const {world,tasks}=recording();
  run(world,instruction(op('TASK_CHAR_SLIDE_TO_COORD_AND_PLAY_ANIM'),
   [int(PED),float(1),float(2),float(3),float(90),float(2),'SIT','PED',float(4),int(1),int(0),int(0),int(1),int(-1)]));
  expect(tasks[0]).toEqual({kind:'slideToCoordAndPlayAnim',x:1,y:2,z:3,heading:90,slideSpeed:2,
   animationName:'SIT',animationFile:'PED',blendSpeed:4,loop:true,lockX:false,lockY:false,
   keepLastFrame:true,time:-1});
 });
});

test('SWITCH_AUDIO_ZONE turns the named audio zones on in the game state, not through the world',()=>{
 const game=new ScmGameState();
 const space=new Uint8Array(4096);space.set(instruction(op('SWITCH_AUDIO_ZONE'),['beach',int(1)]),CODE);
 game.audioZones.load([{name:'BEACH',id:5,active:false,sphere:{center:[0,0,0],radius:10}}]);
 const thread=new ScmThread(space,CODE,0,undefined,{startScript(){},game,world:{fade(){}} as unknown as ScmWorldCommands});
 try{thread.run(0,40);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 expect(game.audioZones.spheres[0].active).toBe(true);
});
