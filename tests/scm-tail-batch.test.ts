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
 const space=new Uint8Array(4096);space.set(instructions.flat(),CODE);
 const host:ScmThreadHost={startScript(){},game,world:{fade(){},...world} as ScmWorldCommands};
 const thread=new ScmThread(space,CODE,0,undefined,host);
 try{thread.run(0,40);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 const view=new DataView(space.buffer);
 return {thread,game,readInt:(offset:number)=>view.getInt32(offset,true),readFloat:(offset:number)=>view.getFloat32(offset,true)};
}
const PED=7,CAR=9,OBJECT=11;
const op=scmOpcode;

describe('the last of the arithmetic',()=>{
 test('the angle between two vectors is in degrees and never negative',()=>{
  const angle=(ax:number,ay:number,bx:number,by:number)=>run({},undefined,
   instruction(op('GET_ANGLE_BETWEEN_2D_VECTORS'),[float(ax),float(ay),float(bx),float(by),gvar(40)])).readFloat(40);
  expect(angle(1,0,1,0)).toBeCloseTo(0,4);
  expect(angle(1,0,0,1)).toBeCloseTo(90,4);
  expect(angle(1,0,-1,0)).toBeCloseTo(180,4);
  expect(angle(0,1,1,0)).toBeCloseTo(90,4);
  // A vector of no length gives no angle rather than a NaN.
  expect(angle(0,0,1,0)).toBeCloseTo(0,4);
 });

 test('an angle is brought back into a single turn, whichever way it ran out',()=>{
  const limit=(value:number)=>run({},undefined,
   instruction(op('LIMIT_ANGLE'),[float(value),gvar(40)])).readFloat(40);
  expect(limit(45)).toBeCloseTo(45,4);
  expect(limit(370)).toBeCloseTo(10,4);
  expect(limit(-10)).toBeCloseTo(350,4);
  expect(limit(-370)).toBeCloseTo(350,4);
  expect(limit(720)).toBeCloseTo(0,4);
 });
});

describe('the tail of vehicle, object and world commands',()=>{
 test('a car inside the three-dimensional box is located whichever way the corners come',()=>{
  const world={vehiclePosition:()=>({x:5,y:5,z:5})};
  const inside=(a:readonly number[],b:readonly number[])=>run(world,undefined,
   instruction(op('IS_CAR_IN_AREA_3D'),[int(CAR),float(a[0]),float(a[1]),float(a[2]),
    float(b[0]),float(b[1]),float(b[2]),int(0)])).thread.condition;
  expect(inside([0,0,0],[10,10,10])).toBe(true);
  expect(inside([10,10,10],[0,0,0])).toBe(true);
  expect(inside([0,0,0],[10,10,2])).toBe(false);
 });

 test('the line of sight names five things it may be stopped by',()=>{
  const calls:unknown[][]=[];
  const {thread}=run({lineOfSightIsClear:(...args:unknown[])=>{calls.push(args);return true;}},undefined,
   instruction(op('IS_LINE_OF_SIGHT_CLEAR'),[float(0),float(0),float(0),float(10),float(0),float(0),
    int(1),int(0),int(1),int(0),int(1)]));
  expect(calls).toEqual([[{x:0,y:0,z:0},{x:10,y:0,z:0},
   {buildings:true,vehicles:false,peds:true,objects:false,particles:true}]]);
  expect(thread.condition).toBe(true);
 });

 test('the model suppression is lifted from the runtime’s own list',()=>{
  const game=new ScmGameState();
  run({},game,instruction(op('SUPPRESS_CAR_MODEL'),[int(411)]));
  expect([...game.suppressedCarModels]).toEqual([411]);
  run({},game,instruction(op('DONT_SUPPRESS_CAR_MODEL'),[int(411)]));
  expect(game.suppressedCarModels.size).toBe(0);
  // DONT_SUPPRESS_ANY_CAR_MODELS empties the whole table (ClearAllSuppressedCarModels; iOS 0x1001f5f2c).
  run({},game,instruction(op('SUPPRESS_CAR_MODEL'),[int(411)]),instruction(op('SUPPRESS_CAR_MODEL'),[int(560)]),instruction(op('DONT_SUPPRESS_ANY_CAR_MODELS'),[]));
  expect(game.suppressedCarModels.size).toBe(0);
 });

 test('the everyone-leave task names a car rather than a ped',()=>{
  const given:{ped:number;task:ScmScriptedTask}[]=[];
  run({givePedScriptedTask:(ped:number,task:ScmScriptedTask)=>{given.push({ped,task});}},undefined,
   instruction(op('TASK_EVERYONE_LEAVE_CAR'),[int(CAR)]));
  expect(given).toEqual([{ped:-1,task:{kind:'everyoneLeaveCar',vehicle:CAR}}]);
 });

 test('the remaining commands pass their own operands',()=>{
  const calls:unknown[][]=[];
  const method=(name:string,result?:unknown)=>(...args:unknown[])=>{calls.push([name,...args]);return result;};
  const world={
   trainCarriage:method('carriage',22),attachVehicleToVehicle:method('attachCar'),
   controlVehicleDoor:method('door'),addToObjectVelocity:method('velocity'),
   attachObjectToObject:method('attachObject'),pointSearchlightAtPed:method('light'),
   drawSphere:method('sphere'),setUpSkip:method('skip'),
   objectSpeed:method('speed',2.5),
  } as unknown as Partial<ScmWorldCommands>;
  const {readInt,readFloat,game:{stats}}=run(world,undefined,
   instruction(op('GET_TRAIN_CARRIAGE'),[int(CAR),int(1),gvar(40)]),
   instruction(op('ATTACH_CAR_TO_CAR'),[int(CAR),int(10),float(0),float(1),float(2),float(0),float(0),float(90)]),
   // The iOS handler reads the ratio as an integer: 0.5's bits are a large positive number, so the door opens fully.
  instruction(op('CONTROL_CAR_DOOR'),[int(CAR),int(2),int(1),float(0.5)]),
   instruction(op('ADD_TO_OBJECT_VELOCITY'),[int(OBJECT),float(1),float(0),float(0)]),
   instruction(op('ATTACH_OBJECT_TO_OBJECT'),[int(OBJECT),int(12),float(0),float(0),float(1),float(0),float(0),float(0)]),
   instruction(op('POINT_SEARCHLIGHT_AT_CHAR'),[int(4),int(PED),float(2)]),
   instruction(op('DRAW_SPHERE'),[float(1),float(2),float(3),float(5)]),
   instruction(op('SET_UP_SKIP'),[float(10),float(20),float(3),float(90)]),
   instruction(op('REGISTER_FASTEST_TIME'),[int(12),int(4500)]),
   instruction(op('GET_OBJECT_SPEED'),[int(OBJECT),gvar(44)]),
   instruction(op('GET_CONTROLLER_MODE'),[gvar(48)]));
  expect(readInt(40)).toBe(22);
  expect(readFloat(44)).toBeCloseTo(2.5,5);
  // REGISTER_FASTEST_TIME is the runtime's own stats now (a stat at 0 takes the time).
  expect(stats.get(12)).toBe(4500);
  // The PC build's controller mode is nought, whatever the host.
  expect(readInt(48)).toBe(0);
  expect(calls).toEqual([
   ['carriage',CAR,1],['attachCar',CAR,10,{x:0,y:1,z:2},{x:0,y:0,z:90}],['door',CAR,2,1,1],
   ['velocity',OBJECT,1,0,0],['attachObject',OBJECT,12,{x:0,y:0,z:1},{x:0,y:0,z:0}],
   ['light',4,PED,2],['sphere',expect.any(Number),1,2,3,5],['skip',10,20,3,90],
   ['speed',OBJECT],
  ]);
 });
});

describe('TASK_TIRED',()=>{
 test('is CTaskSimpleTired: the default group\'s IDLE_tired, blended in at 4 and held for the time given',()=>{
  const given:{ped:number;task:ScmScriptedTask;opcode:number}[]=[];
  run({givePedScriptedTask:(ped:number,task:ScmScriptedTask,opcode:number)=>{given.push({ped,task,opcode});}},undefined,
   instruction(op('TASK_TIRED'),[int(PED),int(4000)]));
  expect(given).toEqual([{ped:PED,opcode:op('TASK_TIRED'),task:{kind:'playAnim',animationName:'IDLE_tired',animationFile:'PED',blendSpeed:4,loop:true,lockX:false,lockY:false,keepLastFrame:false,time:4000,interruptable:true}}]);
 });
});

describe('sprite blips',()=>{
 test('a contact point is made with its blip and its marker, as every iOS sprite blip handler makes it',()=>{
  const game=new ScmGameState();
  run({},game,instruction(op('ADD_SPRITE_BLIP_FOR_CONTACT_POINT'),[float(2495.214),float(-1687.03),float(12.514),int(0),gvar(40)]),
   instruction(op('ADD_SHORT_RANGE_SPRITE_BLIP_FOR_CONTACT_POINT'),[float(426.5),float(2530.7),float(16.1),int(32),gvar(44)]));
  const tracked=game.radar.traces.filter(t=>t.tracking);
  expect(tracked.map(t=>({type:t.type,display:t.display}))).toEqual([{type:5,display:3},{type:5,display:3}]);
 });
});
