import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {scmOpcode} from '../src/engine/scmOpcodes';

/** One instruction over a fresh script space, with the globals before the code. */
const CODE=512;
function instruction(opcode:number,operands:readonly (readonly [number,number])[]){
 const parts:number[][]=[[opcode&0xff,opcode>>8&0xff]];
 for(const [type,value] of operands){
  const bytes=new Uint8Array(4),view=new DataView(bytes.buffer);
  if(type===1){view.setInt32(0,value,true);parts.push([1,...bytes]);}
  else if(type===6){view.setFloat32(0,value,true);parts.push([6,...bytes]);}
  else {view.setUint16(0,value,true);parts.push([type,bytes[0],bytes[1]]);}
 }
 return parts.flat();
}
const int=(value:number)=>[1,value] as const;
const float=(value:number)=>[6,value] as const;
const gvar=(offset:number)=>[2,offset] as const;
function run(world:Partial<ScmWorldCommands>,game:ScmGameState,...instructions:number[][]){
 const space=new Uint8Array(2048);space.set(instructions.flat(),CODE);
 const host:ScmThreadHost={startScript(){},game,world:{fade(){},...world} as ScmWorldCommands};
 const thread=new ScmThread(space,CODE,0,undefined,host);
 try{thread.run(0,32);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return {thread,global:(offset:number)=>new DataView(space.buffer).getInt32(offset,true)};
}
const PED=7,VEHICLE=9;
/** A world holding one ped at a point, on foot unless it is given a vehicle. */
const worldWith=(position:{x:number;y:number;z:number},vehicle?:{appearance:number;train:boolean}):Partial<ScmWorldCommands>=>({
 pedPosition:()=>position,
 pedVehicle:()=>vehicle?VEHICLE:undefined,
 vehicleAppearance:()=>vehicle?.appearance??0,
 vehicleIsTrain:()=>!!vehicle?.train,
});

describe('the locate commands that name a script object',()=>{
 const place=(game:ScmGameState,position:{x:number;y:number;z:number})=>{
  return game.objects.create(1234,position,{external:false,missionCleanup:false}).handle;
 };
 test('a ped inside the box around the object is located, and one outside is not',()=>{
  const game=new ScmGameState();
  const object=place(game,{x:100,y:200,z:10});
  const locate=(position:{x:number;y:number;z:number})=>run(worldWith(position),game,
   instruction(scmOpcode('LOCATE_CHAR_ANY_MEANS_OBJECT_2D'),[int(PED),int(object),float(5),float(5),int(0)])).thread.condition;
  expect(locate({x:102,y:203,z:10})).toBe(true);
  expect(locate({x:110,y:200,z:10})).toBe(false);
 });

 test('the two-dimensional form ignores height and the three-dimensional one does not',()=>{
  const game=new ScmGameState();
  const object=place(game,{x:0,y:0,z:0});
  const high={x:0,y:0,z:50};
  expect(run(worldWith(high),game,instruction(scmOpcode('LOCATE_CHAR_ANY_MEANS_OBJECT_2D'),
   [int(PED),int(object),float(5),float(5),int(0)])).thread.condition).toBe(true);
  expect(run(worldWith(high),game,instruction(scmOpcode('LOCATE_CHAR_ANY_MEANS_OBJECT_3D'),
   [int(PED),int(object),float(5),float(5),float(5),int(0)])).thread.condition).toBe(false);
 });

 test('the on-foot and in-car forms gate on where the ped is before measuring',()=>{
  const game=new ScmGameState();
  const object=place(game,{x:0,y:0,z:0});
  const here={x:1,y:1,z:0};
  const onFoot=worldWith(here),inCar=worldWith(here,{appearance:1,train:false});
  const ask=(name:string,world:Partial<ScmWorldCommands>)=>run(world,game,
   instruction(scmOpcode(name),[int(PED),int(object),float(5),float(5),int(0)])).thread.condition;
  expect(ask('LOCATE_CHAR_ON_FOOT_OBJECT_2D',onFoot)).toBe(true);
  expect(ask('LOCATE_CHAR_ON_FOOT_OBJECT_2D',inCar)).toBe(false);
  expect(ask('LOCATE_CHAR_IN_CAR_OBJECT_2D',inCar)).toBe(true);
  expect(ask('LOCATE_CHAR_IN_CAR_OBJECT_2D',onFoot)).toBe(false);
 });
});

describe('the questions a script asks about what a ped is riding',()=>{
 const ask=(name:string,vehicle?:{appearance:number;train:boolean})=>
  run(worldWith({x:0,y:0,z:0},vehicle),new ScmGameState(),
   instruction(scmOpcode(name),[int(PED)])).thread.condition;
 test('each appearance answers its own command and no other',()=>{
  const cases:[string,number][]=[['IS_CHAR_ON_ANY_BIKE',2],['IS_CHAR_IN_ANY_HELI',3],
   ['IS_CHAR_IN_ANY_BOAT',4],['IS_CHAR_IN_ANY_PLANE',5]];
  for(const [name,appearance] of cases){
   expect(ask(name,{appearance,train:false}),name).toBe(true);
   expect(ask(name,{appearance:1,train:false}),name).toBe(false);
   expect(ask(name),name).toBe(false);
  }
 });
 test('a flying vehicle is a helicopter or a plane',()=>{
  expect(ask('IS_CHAR_IN_FLYING_VEHICLE',{appearance:3,train:false})).toBe(true);
  expect(ask('IS_CHAR_IN_FLYING_VEHICLE',{appearance:5,train:false})).toBe(true);
  expect(ask('IS_CHAR_IN_FLYING_VEHICLE',{appearance:1,train:false})).toBe(false);
  expect(ask('IS_CHAR_IN_FLYING_VEHICLE')).toBe(false);
 });
 test('a train is asked after by the vehicle’s own type, not its appearance',()=>{
  expect(ask('IS_CHAR_IN_ANY_TRAIN',{appearance:0,train:true})).toBe(true);
  expect(ask('IS_CHAR_IN_ANY_TRAIN',{appearance:1,train:false})).toBe(false);
  expect(ask('IS_CHAR_IN_ANY_TRAIN')).toBe(false);
 });
});

describe('the area a ped is in and whether the player may start a mission',()=>{
 test('the area command writes one anywhere but the normal world',()=>{
  const game=new ScmGameState();
  for(const [area,expected] of [[0,0],[3,1],[18,1]] as const){
   const {global}=run({pedAreaCode:()=>area},game,
    instruction(scmOpcode('GET_CHAR_AREA_VISIBLE'),[int(PED),gvar(40)]));
   expect(global(40)).toBe(expected);
  }
 });

 const open={statePlaying:true,coopGoingOn:false,inControl:true,driving:false,alive:true,
  physicalResponseTask:false,eventResponseTask:false,nonDrivePrimaryTask:false,attackTask:false,
  scriptCommandEvent:false};
 const can=(gates:Partial<typeof open>)=>run({playerMissionGates:()=>({...open,...gates})},new ScmGameState(),
  instruction(scmOpcode('CAN_PLAYER_START_MISSION'),[int(0)])).thread.condition;
 test('every gate can refuse on its own',()=>{
  expect(can({})).toBe(true);
  expect(can({statePlaying:false})).toBe(false);
  expect(can({coopGoingOn:true})).toBe(false);
  expect(can({alive:false})).toBe(false);
  expect(can({physicalResponseTask:true})).toBe(false);
  expect(can({eventResponseTask:true})).toBe(false);
  expect(can({nonDrivePrimaryTask:true})).toBe(false);
  expect(can({attackTask:true})).toBe(false);
  expect(can({scriptCommandEvent:true})).toBe(false);
 });
 test('a player who is driving passes the control gate that a passenger fails',()=>{
  expect(can({inControl:false,driving:true})).toBe(true);
  expect(can({inControl:false,driving:false})).toBe(false);
 });
});
