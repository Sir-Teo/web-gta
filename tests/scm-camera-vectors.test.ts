import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {scmOpcode} from '../src/engine/scmOpcodes';

function instruction(opcode:number,operands:readonly (readonly [number,number])[]){
 const out:number[]=[opcode&0xff,opcode>>8&0xff];
 for(const [type,value] of operands){
  const bytes=new Uint8Array(4),view=new DataView(bytes.buffer);
  if(type===1){view.setInt32(0,value,true);out.push(1,...bytes);}
  else {view.setFloat32(0,value,true);out.push(6,...bytes);}
 }
 return out;
}
const int=(value:number)=>[1,value] as const;
const float=(value:number)=>[6,value] as const;
function run(game:ScmGameState,world:Partial<ScmWorldCommands>,nowMs:number,...instructions:number[][]){
 const space=new Uint8Array(1024);space.set(instructions.flat(),0);
 const host:ScmThreadHost={startScript(){},game,world:{fade(){},...world} as ScmWorldCommands};
 const thread=new ScmThread(space,0,0,undefined,host);
 try{thread.run(nowMs,16);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return thread;
}

describe('the two linear runs a script gives the camera',()=>{
 test('the track keeps both points, its window and its ease, and says the camera looks at a vector',()=>{
  const game=new ScmGameState();
  run(game,{},5000,instruction(scmOpcode('CAMERA_SET_VECTOR_TRACK'),
   [float(1),float(2),float(3),float(10),float(20),float(30),int(2500),int(1)]));
  const camera=game.camera;
  expect(camera.trackLinearFrom).toEqual({x:1,y:2,z:3});
  expect(camera.trackLinearTo).toEqual({x:10,y:20,z:30});
  expect(camera.trackLinearStartTime).toBe(5000);
  expect(camera.trackLinearEndTime).toBe(7500);
  expect(camera.trackLinearWithEase).toBe(true);
  expect(camera.vecTrackLinearProcessed).toBe(false);
  expect(camera.lookingAtVector).toBe(true);
 });

 test('the move takes an integer duration and leaves the looking-at flag alone',()=>{
  const game=new ScmGameState();
  const before=game.camera.lookingAtVector;
  run(game,{},1000,instruction(scmOpcode('CAMERA_SET_VECTOR_MOVE'),
   [float(0),float(0),float(0),float(5),float(5),float(5),int(1500),int(0)]));
  expect(game.camera.moveLinearFrom).toEqual({x:0,y:0,z:0});
  expect(game.camera.moveLinearTo).toEqual({x:5,y:5,z:5});
  expect(game.camera.moveLinearStartTime).toBe(1000);
  expect(game.camera.moveLinearEndTime).toBe(2500);
  expect(game.camera.moveLinearWithEase).toBe(false);
  expect(game.camera.lookingAtVector).toBe(before);
 });

 test('each run replaces the one before it and clears the processed mark again',()=>{
  const game=new ScmGameState();
  run(game,{},0,instruction(scmOpcode('CAMERA_SET_VECTOR_TRACK'),
   [float(1),float(1),float(1),float(2),float(2),float(2),int(100),int(0)]));
  game.camera.vecTrackLinearProcessed=true;
  run(game,{},400,instruction(scmOpcode('CAMERA_SET_VECTOR_TRACK'),
   [float(9),float(9),float(9),float(8),float(8),float(8),int(50),int(1)]));
  expect(game.camera.trackLinearFrom).toEqual({x:9,y:9,z:9});
  expect(game.camera.trackLinearStartTime).toBe(400);
  expect(game.camera.trackLinearEndTime).toBe(450);
  expect(game.camera.vecTrackLinearProcessed).toBe(false);
 });

 test('pointing the camera at a car hands the host the mode and the switch the script chose',()=>{
  const calls:unknown[]=[];
  run(new ScmGameState(),{pointCameraAtVehicle:(...args)=>{calls.push(args);}},0,
   instruction(scmOpcode('POINT_CAMERA_AT_CAR'),[int(12),int(15),int(1)]));
  expect(calls).toEqual([[12,15,1]]);
 });
});

describe('the offset from a ped, and what one ped can see',()=>{
 test('the offset runs through the ped’s own rows, right then forward then up',()=>{
  // A ped turned a quarter turn: its forward points along the world's x and its right along negative y.
  const matrix={right:{x:0,y:-1,z:0},forward:{x:1,y:0,z:0},up:{x:0,y:0,z:1},position:{x:100,y:200,z:5}};
  const game=new ScmGameState();
  const space=new Uint8Array(1024);
  space.set(instruction(scmOpcode('GET_OFFSET_FROM_CHAR_IN_WORLD_COORDS'),
   [int(7),float(2),float(3),float(4)]).concat([2,40,0,2,44,0,2,48,0]),0);
  const host:ScmThreadHost={startScript(){},game,world:{fade(){},pedMatrix:()=>matrix} as ScmWorldCommands};
  const thread=new ScmThread(space,0,0,undefined,host);
  try{thread.run(0,4);}catch(error){if(!String(error).includes('watchdog'))throw error;}
  const view=new DataView(space.buffer);
  expect(view.getFloat32(40,true)).toBeCloseTo(103,4);
  expect(view.getFloat32(44,true)).toBeCloseTo(198,4);
  expect(view.getFloat32(48,true)).toBeCloseTo(9,4);
 });

 test('spotting another ped is asked of the pair the command names',()=>{
  const asked:number[][]=[];
  const world={pedCanSeePed:(handle:number,other:number)=>{asked.push([handle,other]);return handle===1;}};
  expect(run(new ScmGameState(),world,0,instruction(scmOpcode('HAS_CHAR_SPOTTED_CHAR'),[int(1),int(2)])).condition).toBe(true);
  expect(run(new ScmGameState(),world,0,instruction(scmOpcode('HAS_CHAR_SPOTTED_CHAR'),[int(3),int(2)])).condition).toBe(false);
  expect(asked).toEqual([[1,2],[3,2]]);
 });
});

describe('the locate commands that name a vehicle',()=>{
 test('the box is measured around the car the command names, with the same gates',()=>{
  const world=(pedAt:{x:number;y:number;z:number},inCar:boolean)=>({
   pedPosition:()=>pedAt,vehiclePosition:()=>({x:0,y:0,z:0}),
   pedVehicle:()=>inCar?9:undefined,
  });
  const ask=(name:string,pedAt:{x:number;y:number;z:number},inCar:boolean,operands:readonly (readonly [number,number])[])=>
   run(new ScmGameState(),world(pedAt,inCar),0,instruction(scmOpcode(name),operands)).condition;
  const near=[int(7),int(9),float(5),float(5),int(0)] as const;
  expect(ask('LOCATE_CHAR_ANY_MEANS_CAR_2D',{x:2,y:2,z:0},false,near)).toBe(true);
  expect(ask('LOCATE_CHAR_ANY_MEANS_CAR_2D',{x:20,y:2,z:0},false,near)).toBe(false);
  expect(ask('LOCATE_CHAR_ON_FOOT_CAR_2D',{x:2,y:2,z:0},true,near)).toBe(false);
  expect(ask('LOCATE_CHAR_IN_CAR_CAR_2D',{x:2,y:2,z:0},true,near)).toBe(true);
  // The three-dimensional form takes a third radius and measures height too.
  const high=[int(7),int(9),float(5),float(5),float(5),int(0)] as const;
  expect(ask('LOCATE_CHAR_ANY_MEANS_CAR_3D',{x:2,y:2,z:50},false,high)).toBe(false);
  expect(ask('LOCATE_CHAR_ANY_MEANS_CAR_3D',{x:2,y:2,z:1},false,high)).toBe(true);
 });
});

describe('where the linear runs put the camera (authored ProcessVectorMoveLinear/TrackLinear)',()=>{
 test('a plain move runs straight from end to end over its window and then lets go',()=>{
  const game=new ScmGameState(),camera=game.camera;
  camera.vectorMoveLinear({x:0,y:0,z:0},{x:10,y:20,z:30},1000,false,5000);
  expect(camera.moveLinearPoint(4999)).toBeUndefined();
  expect(camera.moveLinearPoint(5000)).toEqual({x:0,y:0,z:0});
  expect(camera.moveLinearPoint(5250)).toEqual({x:2.5,y:5,z:7.5});
  expect(camera.moveLinearPoint(6000)).toEqual({x:10,y:20,z:30});
  expect(camera.moveLinearPoint(6001)).toBeUndefined();
 });
 test('an eased run starts and ends at rest, and a persisted one holds its far end until the scriptables reset',()=>{
  const game=new ScmGameState(),camera=game.camera;
  camera.cameraPersistTrack=true;
  camera.vectorTrackLinear({x:0,y:0,z:0},{x:100,y:0,z:0},1000,true,0);
  expect(camera.trackLinearPoint(500)!.x).toBeCloseTo(50,6);
  expect(camera.trackLinearPoint(100)!.x).toBeLessThan(10);
  expect(camera.trackLinearPoint(900)!.x).toBeGreaterThan(90);
  expect(camera.trackLinearPoint(60000)).toEqual({x:100,y:0,z:0});
  camera.initialiseScriptableComponents();
  expect(camera.trackLinearPoint(60000)).toBeUndefined();
 });
});
