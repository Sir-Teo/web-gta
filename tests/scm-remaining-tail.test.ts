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
function run(world:Partial<ScmWorldCommands>,...instructions:number[][]){
 const space=new Uint8Array(4096);space.set(instructions.flat(),CODE);
 const host:ScmThreadHost={startScript(){},game:new ScmGameState(),world:{fade(){},...world} as ScmWorldCommands};
 const thread=new ScmThread(space,CODE,0,undefined,host);
 try{thread.run(0,40);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 const view=new DataView(space.buffer);
 return {thread,readInt:(offset:number)=>view.getInt32(offset,true),readFloat:(offset:number)=>view.getFloat32(offset,true)};
}
const PED=7,CAR=9,OBJECT=11;
const op=scmOpcode;

describe('the lookups that give back points',()=>{
 test('the three node lookups each write what they were asked for',()=>{
  const calls:unknown[][]=[];
  const method=(name:string,result:unknown)=>(...args:unknown[])=>{calls.push([name,...args]);return result;};
  const world={
   closestVehicleNode:method('closest',{x:1,y:2,z:3}),
   nthClosestVehicleNode:method('nth',{x:4,y:5,z:6}),
   closestVehicleNodeWithHeading:method('heading',{x:7,y:8,z:9,heading:90}),
  } as unknown as Partial<ScmWorldCommands>;
  const closest=run(world,instruction(op('GET_CLOSEST_CAR_NODE'),
   [float(0),float(0),float(0),gvar(40),gvar(44),gvar(48)]));
  expect([closest.readFloat(40),closest.readFloat(44),closest.readFloat(48)]).toEqual([1,2,3]);
  const nth=run(world,instruction(op('GET_NTH_CLOSEST_CAR_NODE'),
   [float(0),float(0),float(0),int(3),gvar(40),gvar(44),gvar(48)]));
  expect([nth.readFloat(40),nth.readFloat(44),nth.readFloat(48)]).toEqual([4,5,6]);
  const heading=run(world,instruction(op('GET_CLOSEST_CAR_NODE_WITH_HEADING'),
   [float(0),float(0),float(0),gvar(40),gvar(44),gvar(48),gvar(52)]));
  expect([heading.readFloat(40),heading.readFloat(52)]).toEqual([7,90]);
  expect(calls.map(call=>call[0])).toEqual(['closest','nth','heading']);
 });

 test('a model’s bounds come back as two opposite corners',()=>{
  const {readFloat}=run({modelDimensions:()=>({min:{x:-1,y:-2,z:-3},max:{x:1,y:2,z:3}})},
   instruction(op('GET_MODEL_DIMENSIONS'),[int(411),gvar(40),gvar(44),gvar(48),gvar(52),gvar(56),gvar(60)]));
  expect([readFloat(40),readFloat(44),readFloat(48)]).toEqual([-1,-2,-3]);
  expect([readFloat(52),readFloat(56),readFloat(60)]).toEqual([1,2,3]);
 });

 test('the group size gives back whether it has a leader, then how many follow',()=>{
  const {readInt}=run({groupSize:()=>({members:4,leader:1})},
   instruction(op('GET_GROUP_SIZE'),[int(3),gvar(40),gvar(44)]));
  expect([readInt(40),readInt(44)]).toEqual([1,4]);
 });

 test('the plain colours are the first two of the four a vehicle carries',()=>{
  const {readInt}=run({vehicleColours:()=>({primary:1,secondary:2,tertiary:3,quaternary:4})},
   instruction(op('GET_CAR_COLOURS'),[int(CAR),gvar(40),gvar(44)]));
  expect([readInt(40),readInt(44)]).toEqual([1,2]);
 });
});

describe('the questions and switches of the tail',()=>{
 test('the occupied question names five kinds of thing that may stand in the box',()=>{
  const calls:unknown[][]=[];
  const {thread}=run({areaIsOccupied:(...args:unknown[])=>{calls.push(args);return true;}},
   instruction(op('IS_AREA_OCCUPIED'),[float(0),float(0),float(0),float(10),float(10),float(10),
    int(1),int(1),int(0),int(0),int(1)]));
  expect(calls).toEqual([[{x:0,y:0,z:0},{x:10,y:10,z:10},
   {solid:true,vehicles:true,peds:false,objects:false,particles:true}]]);
  expect(thread.condition).toBe(true);
 });

 test('the simple questions answer for what the command names',()=>{
  const cases:[string,keyof ScmWorldCommands,readonly (readonly [number,number])[]][]=[
   ['IS_CHAR_IN_AIR','pedIsInAir',[int(PED)]],
   ['IS_OBJECT_STATIC','objectIsStatic',[int(OBJECT)]],
   ['IS_OBJECT_IN_WATER','objectIsInWater',[int(OBJECT)]],
   ['IS_CAR_VISIBLY_DAMAGED','vehicleIsVisiblyDamaged',[int(CAR)]],
   ['IS_CHAR_HEAD_MISSING','pedHeadIsMissing',[int(PED)]],
  ];
  for(const [name,method,operands] of cases){
   const on={[method]:()=>true} as Partial<ScmWorldCommands>;
   const off={[method]:()=>false} as Partial<ScmWorldCommands>;
   expect(run(on,instruction(op(name),operands)).thread.condition,name).toBe(true);
   expect(run(off,instruction(op(name),operands)).thread.condition,name).toBe(false);
  }
 });

 test('the remaining commands pass their own operands',()=>{
  const calls:unknown[][]=[];
  const method=(name:string,result?:unknown)=>(...args:unknown[])=>{calls.push([name,...args]);return result;};
  const world={
   startVehicleFire:method('fire',7),fixVehicleDoor:method('fixDoor'),popVehiclePanel:method('panel'),
   heliFollowEntity:method('heliFollow'),setVehicleFollowVehicle:method('follow'),
   waterHeightAtCoords:method('water',0.5),createUser3dMarker:method('marker',3),
   createEmergencyServicesVehicle:method('emergency'),
  } as unknown as Partial<ScmWorldCommands>;
  const {readInt,readFloat}=run(world,
   instruction(op('START_CAR_FIRE'),[int(CAR),gvar(40)]),
   instruction(op('FIX_CAR_DOOR'),[int(CAR),int(2)]),
   instruction(op('POP_CAR_PANEL'),[int(CAR),int(1),int(1)]),
   instruction(op('HELI_FOLLOW_ENTITY'),[int(CAR),int(PED),int(10),float(25)]),
   instruction(op('SET_CAR_FOLLOW_CAR'),[int(CAR),int(10),float(15)]),
   instruction(op('GET_WATER_HEIGHT_AT_COORDS'),[float(1),float(2),int(1),gvar(44)]),
   instruction(op('CREATE_USER_3D_MARKER'),[float(1),float(2),float(3),int(4),gvar(48)]),
   instruction(op('CREATE_EMERGENCY_SERVICES_CAR'),[int(416),float(1),float(2),float(3)]),
   instruction(op('ADD_BLIP_FOR_SEARCHLIGHT'),[int(8),gvar(52)]));
  expect(readInt(40)).toBe(7);
  expect(readFloat(44)).toBeCloseTo(0.5,5);
  expect(readInt(48)).toBe(3);
  // ADD_BLIP_FOR_SEARCHLIGHT is the radar's own spotlight blip: the first trace's first handle.
  expect(readInt(52)).toBe(1<<16);
  expect(calls).toEqual([
   ['fire',CAR],['fixDoor',CAR,2],['panel',CAR,1,true],['heliFollow',CAR,PED,10,25],['follow',CAR,10,15],
   ['water',1,2,true],['marker',1,2,3,4],['emergency',416,1,2,3],
  ]);
 });

 test('the last three tasks carry their own operands',()=>{
  const tasks:ScmScriptedTask[]=[];
  run({givePedScriptedTask:(_ped:number,task:ScmScriptedTask)=>{tasks.push(task);}},
   instruction(op('TASK_LEAVE_CAR_AND_FLEE'),[int(PED),int(CAR),float(1),float(2),float(3)]),
   instruction(op('TASK_GOTO_CAR'),[int(PED),int(CAR),int(4000),float(2)]),
   instruction(op('TASK_DEAD'),[int(PED)]));
  expect(tasks).toEqual([
   {kind:'leaveCarAndFlee',vehicle:CAR,x:1,y:2,z:3},
   {kind:'gotoCar',vehicle:CAR,time:4000,radius:2},
   {kind:'dead'},
  ]);
 });
});
