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

describe('where two lines cross',()=>{
 test('two crossing lines give their meeting point',()=>{
  const {readFloat}=run({},undefined,instruction(op('GET_2D_LINES_INTERSECT_POINT'),
   [float(0),float(0),float(10),float(10),float(0),float(10),float(10),float(0),gvar(40),gvar(44)]));
  expect(readFloat(40)).toBeCloseTo(5,4);
  expect(readFloat(44)).toBeCloseTo(5,4);
 });

 test('parallel lines leave the point where it was rather than dividing by nothing',()=>{
  const space=new Uint8Array(4096);
  const view=new DataView(space.buffer);
  view.setFloat32(40,123,true);view.setFloat32(44,456,true);
  space.set(instruction(op('GET_2D_LINES_INTERSECT_POINT'),
   [float(0),float(0),float(10),float(0),float(0),float(5),float(10),float(5),gvar(40),gvar(44)]),CODE);
  const host:ScmThreadHost={startScript(){},game:new ScmGameState(),world:{fade(){}} as ScmWorldCommands};
  const thread=new ScmThread(space,CODE,0,undefined,host);
  try{thread.run(0,4);}catch(error){if(!String(error).includes('watchdog'))throw error;}
  expect(view.getFloat32(40,true)).toBeCloseTo(123,3);
  expect(view.getFloat32(44,true)).toBeCloseTo(456,3);
 });
});

describe('the last of the tail',()=>{
 test('a car stopped inside the box needs both the box and the stop',()=>{
  const inside={vehiclePosition:()=>({x:5,y:5,z:5}),vehicleIsStopped:()=>true};
  const operands=[int(CAR),float(0),float(0),float(0),float(10),float(10),float(10),int(0)] as const;
  expect(run(inside,undefined,instruction(op('IS_CAR_STOPPED_IN_AREA_3D'),operands)).thread.condition).toBe(true);
  expect(run({...inside,vehicleIsStopped:()=>false},undefined,
   instruction(op('IS_CAR_STOPPED_IN_AREA_3D'),operands)).thread.condition).toBe(false);
  expect(run({...inside,vehiclePosition:()=>({x:50,y:5,z:5})},undefined,
   instruction(op('IS_CAR_STOPPED_IN_AREA_3D'),operands)).thread.condition).toBe(false);
 });

 test('the 2D stopped form, and the highlight every car area form draws when asked (iOS 0x1001df2e4)',()=>{
  const drawn:number[]=[];
  const inside={vehiclePosition:()=>({x:10,y:0,z:500}),vehicleIsStopped:()=>true,highlightArea:(_id:number,_c:unknown,halfX:number)=>{drawn.push(halfX);}};
  // Each axis is inclusive, and the height does not matter in 2D.
  const operands=(flag:number)=>[int(CAR),float(0),float(0),float(10),float(10),int(flag)] as const;
  expect(run(inside,undefined,instruction(op('IS_CAR_STOPPED_IN_AREA_2D'),operands(0))).thread.condition).toBe(true);
  expect(run({...inside,vehicleIsStopped:()=>false},undefined,instruction(op('IS_CAR_STOPPED_IN_AREA_2D'),operands(1))).thread.condition).toBe(false);
  expect(drawn).toEqual([5]);
  run(inside,undefined,instruction(op('IS_CAR_IN_AREA_3D'),[int(CAR),float(0),float(0),float(0),float(4),float(4),float(4),int(1)]));
  expect(drawn).toEqual([5,2]);
 });

 test('the three model questions each ask their own',()=>{
  const asked:string[]=[];
  const world={modelIsBoat:()=>{asked.push('boat');return true;},modelIsHeli:()=>{asked.push('heli');return false;},
   modelIsPlane:()=>{asked.push('plane');return true;}};
  expect(run(world,undefined,instruction(op('IS_THIS_MODEL_A_BOAT'),[int(472)])).thread.condition).toBe(true);
  expect(run(world,undefined,instruction(op('IS_THIS_MODEL_A_HELI'),[int(487)])).thread.condition).toBe(false);
  expect(run(world,undefined,instruction(op('IS_THIS_MODEL_A_PLANE'),[int(519)])).thread.condition).toBe(true);
  expect(asked).toEqual(['boat','heli','plane']);
 });

 test('the wanted ceiling is read back from the runtime’s own field',()=>{
  const game=new ScmGameState();
  expect(run({},game,instruction(op('GET_MAX_WANTED_LEVEL'),[gvar(40)])).readInt(40)).toBe(6);
  game.setMaximumWantedLevel(4);
  expect(run({},game,instruction(op('GET_MAX_WANTED_LEVEL'),[gvar(40)])).readInt(40)).toBe(4);
 });

 test('TASK_SHAKE_FIST is CTaskSimpleShakeFist: the FUCKU clip at a blend of 4, over when it finishes',()=>{
  const tasks:ScmScriptedTask[]=[];
  run({givePedScriptedTask:(_ped:number,task:ScmScriptedTask)=>{tasks.push(task);}},undefined,instruction(op('TASK_SHAKE_FIST'),[int(PED)]));
  expect(tasks).toEqual([{kind:'playAnim',animationName:'fucku',animationFile:'ped',blendSpeed:4,loop:false,lockX:false,lockY:false,keepLastFrame:false,time:-1,interruptable:true}]);
 });

 test('the last tasks carry their own operands',()=>{
  const tasks:ScmScriptedTask[]=[];
  run({givePedScriptedTask:(_ped:number,task:ScmScriptedTask)=>{tasks.push(task);}},undefined,
   instruction(op('TASK_LOOK_AT_VEHICLE'),[int(PED),int(CAR),int(2000)]),
   instruction(op('TASK_WEAPON_ROLL'),[int(PED),int(1)]),
   instruction(op('TASK_FALL_AND_GET_UP'),[int(PED),int(1),int(1500)]),
   instruction(op('TASK_GOTO_CHAR_OFFSET'),[int(PED),int(8),int(3000),float(1),float(2)]),
   instruction(op('TASK_FOLLOW_FOOTSTEPS'),[int(PED),int(8)]),
   instruction(op('TASK_SWIM_TO_COORD'),[int(PED),float(1),float(2),float(0)]));
  expect(tasks).toEqual([
   {kind:'lookAtVehicle',vehicle:CAR,time:2000},
   {kind:'weaponRoll',state:true},
   {kind:'fallAndGetUp',state:true,time:1500},
   {kind:'gotoPedOffset',target:8,time:3000,offsetX:1,offsetY:2},
   {kind:'followFootsteps',target:8},
   {kind:'swimToCoord',x:1,y:2,z:0},
  ]);
 });

 test('the searchlight on a vehicle passes its operands, and the camera hung on one takes control attached to it',()=>{
  const calls:unknown[][]=[];
  const method=(name:string,result?:unknown)=>(...args:unknown[])=>{calls.push([name,...args]);return result;};
  const world={createSearchlightOnVehicle:method('light',8),moveSearchlightBetweenCoords:method('move'),
  } as unknown as Partial<ScmWorldCommands>;
  const {readInt,game}=run(world,undefined,
   instruction(op('CREATE_SEARCHLIGHT_ON_VEHICLE'),
    [int(CAR),float(0),float(1),float(2),float(10),float(20),float(30),float(5),float(9),gvar(40)]),
   instruction(op('MOVE_SEARCHLIGHT_BETWEEN_COORDS'),
    [int(8),float(0),float(0),float(0),float(10),float(10),float(10),float(2)]),
   instruction(op('ATTACH_CAMERA_TO_VEHICLE'),
    [int(CAR),float(0),float(-5),float(2),float(0),float(0),float(0),float(15),int(1)]));
  expect(readInt(40)).toBe(8);
  expect(calls).toEqual([
   ['light',CAR,{x:0,y:1,z:2},{x:10,y:20,z:30},5,9],
   ['move',8,{x:0,y:0,z:0},{x:10,y:10,z:10},2],
  ]);
  const camera=game.camera;
  // The script's control (1), as the iOS handler passes it.
  expect(camera.modeToGoTo).toBe(47);expect(camera.lookingAtPlayer).toBe(false);expect(camera.whoIsInControlOfTheCamera).toBe(1);
  expect(camera.attached).toEqual({kind:'vehicle',handle:CAR,offset:{x:0,y:-5,z:2},lookAt:{x:0,y:0,z:0},tilt:15});
  expect(camera.targetEntity).toBeUndefined();expect(camera.typeOfSwitch).toBe(1);
  // TakeControlAttachToEntity (iOS 0x10022de3c): an offset of nothing is two units up, and a look-at point the same as
  // the offset is the entity's origin.
  camera.takeControlAttachToEntity(undefined,{kind:'vehicle',handle:CAR},{x:0,y:0,z:0},{x:1,y:2,z:3},0,1,1);
  expect(camera.attached).toMatchObject({offset:{x:0,y:0,z:2},lookAt:{x:1,y:2,z:3}});
  camera.takeControlAttachToEntity(undefined,{kind:'vehicle',handle:CAR},{x:1,y:2,z:3},{x:1,y:2,z:3},0,1,1);
  expect(camera.attached).toMatchObject({offset:{x:1,y:2,z:3},lookAt:{x:0,y:0,z:0}});
  // Looking at another vehicle, and from the car at a ped: the target entity, no look-at point.
  run({},game,instruction(op('ATTACH_CAMERA_TO_VEHICLE_LOOK_AT_VEHICLE'),[int(CAR),float(0),float(-5),float(2),int(10),float(15),int(1)]));
  expect(camera.targetEntity).toEqual({kind:'vehicle',handle:10});expect(camera.attached?.lookAt).toBeUndefined();
  run({},game,instruction(op('ATTACH_CAMERA_TO_VEHICLE_LOOK_AT_CHAR'),[int(CAR),float(1),float(-4),float(1),int(PED),float(0),int(2)]));
  expect(camera.targetEntity).toEqual({kind:'ped',handle:PED});expect(camera.attached?.offset).toEqual({x:1,y:-4,z:1});
  // The restore hands it back and lets go of the entity.
  camera.restoreWithJumpCut({inVehicle:false,enteringCar:false,exitingCar:false});
  expect(camera.attached).toBeUndefined();expect(camera.lookingAtPlayer).toBe(true);
 });
});
