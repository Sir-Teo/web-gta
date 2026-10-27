import {beforeAll,describe,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {MODE_CAM_ON_A_STRING,MODE_FIXED,MODE_FOLLOWPED,OBBE_MODE_DEFAULT,SWITCH_INTERPOLATION,SWITCH_JUMPCUT} from '../src/engine/ScmCamera';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';

const file=()=>new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
const onFoot={inVehicle:false,enteringCar:false,exitingCar:false};
function threadAt(bytes:Uint8Array,offset:number,game:ScmGameState,world?:Partial<ScmWorldCommands>){
 const adapter={fade(){},playerCameraState:()=>onFoot,groundZForCoord:()=>7.5,...world} as ScmWorldCommands;
 const host:ScmThreadHost={startScript(){throw new Error('unexpected');},game,world:adapter};
 return new ScmThread(bytes,offset,0,undefined,host);
}
const runOne=(thread:ScmThread)=>{try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}};
// Decode the original program once; each command still runs against its own copy of script memory.
let original:{bytes:Uint8Array;instructions:ReturnType<typeof decodeScmInstructions>};
beforeAll(()=>{
 const bytes=file(),header=readScmHeader(bytes);
 const blocks=[decodeScmInstructions(bytes,header.entry,header.mainSize)];
 for(const m of header.missions){try{blocks.push(decodeScmInstructions(bytes,m.start,m.end));}catch{/* undecodable tail */}}
 original={bytes,instructions:blocks.flat()};
});
function find(name:string){
 const found=original.instructions.find(i=>i.name===name&&i.parameters.every(p=>[1,4,5,6].includes(p.type)));
 expect(found,`${name} with literal operands`).toBeDefined();
 return {bytes:original.bytes.slice(),instruction:found!};
}

describe('TheCamera script commands',()=>{
 test('SET_FIXED_CAMERA_POSITION stores the source and its up offset',()=>{
  const {bytes,instruction}=find('SET_FIXED_CAMERA_POSITION');
  const game=new ScmGameState();
  runOne(threadAt(bytes,instruction.offset,game));
  const values=instruction.parameters.map(p=>p.value as number);
  expect(game.camera.fixedModeSource.x).toBeCloseTo(values[0],3);
  expect(game.camera.fixedModeSource.z).toBeCloseTo(values[2],3);
  expect(game.camera.fixedModeUpOffset.y).toBeCloseTo(values[4],3);
  expect(game.camera.garageFixedCamPositionSet).toBe(false);
 });

 test('POINT_CAMERA_AT_POINT takes control and fixes the camera on the point',()=>{
  const {bytes,instruction}=find('POINT_CAMERA_AT_POINT');
  const game=new ScmGameState();
  runOne(threadAt(bytes,instruction.offset,game));
  expect(game.camera.modeToGoTo).toBe(MODE_FIXED);
  expect(game.camera.lookingAtVector).toBe(true);
  expect(game.camera.lookingAtPlayer).toBe(false);
  expect(game.camera.whoIsInControlOfTheCamera).toBe(1);
  expect(game.camera.startInterScript).toBe(true);
  expect(game.camera.fixedModeVector.x).toBeCloseTo(instruction.parameters[0].value as number,3);
 });

 test('a target below minus a hundred means the ground under it',()=>{
  // POINT_CAMERA_AT_POINT with three float operands and one byte switch type, assembled here so the z operand
  // can carry the sentinel the handler tests for.
  const bytes=new Uint8Array(2+3*5+2);
  const view=new DataView(bytes.buffer);
  view.setUint16(0,0x160,true);
  for(const [k,value] of [10,20,-200].entries()){bytes[2+k*5]=6;view.setFloat32(3+k*5,value,true);}
  bytes[17]=4;bytes[18]=SWITCH_JUMPCUT;
  const game=new ScmGameState();
  runOne(threadAt(bytes,0,game,{groundZForCoord:(x,y)=>x+y}));
  expect(game.camera.fixedModeVector).toEqual({x:10,y:20,z:30});
  expect(game.camera.typeOfSwitch).toBe(SWITCH_JUMPCUT);
 });

 test('a script take-over does not push a cutscene off the camera',()=>{
  const game=new ScmGameState();
  game.camera.takeControlNoEntity({x:1,y:2,z:3},SWITCH_JUMPCUT,1);
  game.camera.takeControlNoEntity({x:9,y:9,z:9},SWITCH_INTERPOLATION,2);
  expect(game.camera.whoIsInControlOfTheCamera).toBe(1);
  expect(game.camera.fixedModeVector).toEqual({x:1,y:2,z:3});
 });

 test('RESTORE_CAMERA_JUMPCUT hands the camera back to the player and cuts to it',()=>{
  const {bytes,instruction}=find('RESTORE_CAMERA_JUMPCUT');
  const game=new ScmGameState();
  game.camera.takeControlNoEntity({x:1,y:2,z:3},SWITCH_INTERPOLATION,1);
  runOne(threadAt(bytes,instruction.offset,game));
  expect(game.camera.modeToGoTo).toBe(MODE_FOLLOWPED);
  expect(game.camera.target).toBe('player');
  expect(game.camera.typeOfSwitch).toBe(SWITCH_JUMPCUT);
  expect(game.camera.restoreByJumpCut).toBe(true);
  expect(game.camera.lookingAtPlayer).toBe(true);
  expect(game.camera.lookingAtVector).toBe(false);
  expect(game.camera.whoIsInControlOfTheCamera).toBe(0);
  expect(game.camera.modeObbeCamIsInForCar).toBe(OBBE_MODE_DEFAULT);
 });

 test('the restore picks the car camera for a player in a vehicle or climbing into one',()=>{
  const game=new ScmGameState();
  game.camera.restore({inVehicle:true,enteringCar:false,exitingCar:false});
  expect(game.camera.modeToGoTo).toBe(MODE_CAM_ON_A_STRING);
  expect(game.camera.target).toBe('vehicle');
  expect(game.camera.typeOfSwitch).toBe(SWITCH_INTERPOLATION);
  expect(game.camera.cameraJustRestored).toBe(true);
  game.camera.restore({inVehicle:false,enteringCar:true,exitingCar:false});
  expect(game.camera.modeToGoTo).toBe(MODE_CAM_ON_A_STRING);
  // Leaving a car puts the camera back on foot even while the player still counts as inside it.
  game.camera.restore({inVehicle:true,enteringCar:false,exitingCar:true});
  expect(game.camera.modeToGoTo).toBe(MODE_FOLLOWPED);
  expect(game.camera.target).toBe('player');
 });
});
