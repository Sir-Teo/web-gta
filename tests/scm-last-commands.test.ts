import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {MODE_CAM_ON_A_STRING,MODE_FIXED,MODE_FOLLOWPED} from '../src/engine/ScmCamera';
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
 try{thread.run(0,16);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 const view=new DataView(space.buffer);
 return {thread,game,readInt:(offset:number)=>view.getInt32(offset,true),readFloat:(offset:number)=>view.getFloat32(offset,true)};
}
const PED=7,CAR=9,OBJECT=11;

describe('the last of the ped questions',()=>{
 test('the model questions read the same model, one comparing and one storing',()=>{
  const world={pedModelId:()=>287};
  expect(run(world,undefined,instruction(scmOpcode('IS_CHAR_MODEL'),[int(PED),int(287)])).thread.condition).toBe(true);
  expect(run(world,undefined,instruction(scmOpcode('IS_CHAR_MODEL'),[int(PED),int(288)])).thread.condition).toBe(false);
  expect(run(world,undefined,instruction(scmOpcode('GET_CHAR_MODEL'),[int(PED),gvar(40)])).readInt(40)).toBe(287);
 });

 test('a velocity is read in units a second, fifty times the engine’s, as SET_CHAR_VELOCITY takes it',()=>{
  // player_parachute starts the free fall under -10 and Freefall hands the reading back to SET_CHAR_VELOCITY.
  const {readFloat}=run({pedVelocity:()=>({x:0.2,y:-0.1,z:-0.4})},undefined,
   instruction(scmOpcode('GET_CHAR_VELOCITY'),[int(PED),gvar(40),gvar(44),gvar(48)]));
  expect(readFloat(40)).toBeCloseTo(10,5);
  expect(readFloat(44)).toBeCloseTo(-5,5);
  expect(readFloat(48)).toBeCloseTo(-20,5);
 });

 test('SET_CHAR_ROTATION hands the world the Euler degrees as the script gives them',()=>{
  // player_parachute pitches CJ by 3@ and banks him by 2@ under the heading 1@ every frame of the fall.
  const calls:number[][]=[];
  run({setPedRotation:(handle,x,y,z)=>{calls.push([handle,x,y,z]);}},undefined,
   instruction(scmOpcode('SET_CHAR_ROTATION'),[int(PED),float(-12.5),float(20),float(270)]));
  expect(calls).toEqual([[PED,-12.5,20,270]]);
 });

 test('REMOVE_OBJECT_ELEGANTLY fades the object out of the cleanup and away, and leaves a handle already gone alone',()=>{
  const game=new ScmGameState(),handle=game.objects.create(3131,{x:0,y:0,z:0},{external:false,missionCleanup:true}).handle;
  run({},game,instruction(scmOpcode('REMOVE_OBJECT_ELEGANTLY'),[int(handle)]));
  // Off the cleanup, fading from 255 by 16 a frame (iOS 0x100203a28, CObject::PreRender).
  expect(game.objects.at(handle)).toMatchObject({missionCleanup:false,fadeAlpha:255});
  game.objects.advanceFades(1/30);expect(game.objects.at(handle).fadeAlpha).toBeCloseTo(239,6);
  // At 0, ManageObject deletes it: after the 16th frame (15 left after the 15th).
  game.objects.advanceFades(14/30);expect(game.objects.at(handle).fadeAlpha).toBeCloseTo(15,6);
  game.objects.advanceFades(1/30);expect(game.objects.exists(handle)).toBe(false);
  const {thread}=run({},game,instruction(scmOpcode('REMOVE_OBJECT_ELEGANTLY'),[int(handle)]));
  expect(thread.ip).toBeGreaterThan(CODE);
 });

 test('ALLOW_PAUSE_IN_WIDESCREEN sets and clears CTheScripts::bAllowPauseInWidescreen',()=>{
  const {game}=run({},undefined,instruction(scmOpcode('ALLOW_PAUSE_IN_WIDESCREEN'),[int(1)]));
  expect(game.allowPauseInWidescreen).toBe(true);
  run({},game,instruction(scmOpcode('ALLOW_PAUSE_IN_WIDESCREEN'),[int(0)]));
  expect(game.allowPauseInWidescreen).toBe(false);
 });

 test('GET_RANDOM_CHAR_IN_AREA_OFFSET_NO_SAVE asks for a ped in the box of the point and its half-extents',()=>{
  const calls:unknown[]=[];
  const {readInt}=run({randomPedInBox:(...a:number[])=>{calls.push(a);return 1030;}},undefined,
   instruction(scmOpcode('GET_RANDOM_CHAR_IN_AREA_OFFSET_NO_SAVE'),[float(10),float(20),float(30),float(.6),float(.6),float(1),gvar(40)]));
  expect(calls).toHaveLength(1);(calls[0] as number[]).forEach((v,k)=>expect(v).toBeCloseTo([10,20,30,.6,.6,1][k],5));expect(readInt(40)).toBe(1030);
 });

 test('no second player is ever in the game',()=>{
  expect(run({},undefined,instruction(scmOpcode('IS_2PLAYER_GAME_GOING_ON'),[])).thread.condition).toBe(false);
 });

 test('the on-foot touching question does not fall back to the car a ped rides',()=>{
  const touching={pedIsTouching:()=>true};
  expect(run({...touching,pedVehicle:()=>undefined},undefined,
   instruction(scmOpcode('IS_CHAR_TOUCHING_OBJECT_ON_FOOT'),[int(PED),int(OBJECT)])).thread.condition).toBe(true);
  expect(run({...touching,pedVehicle:()=>CAR},undefined,
   instruction(scmOpcode('IS_CHAR_TOUCHING_OBJECT_ON_FOOT'),[int(PED),int(OBJECT)])).thread.condition).toBe(false);
 });

 test('the remaining ped questions and flags reach the host with what the script named',()=>{
  const calls:unknown[]=[];
  const world={
   pedIsMale:()=>true,pedIsGettingIntoCar:()=>true,pedIsWaitingForCollision:()=>true,
   pedWasDamagedByVehicle:(...a:unknown[])=>{calls.push(['damaged',...a]);return true;},
   pedCanSeeDeadPed:(...a:unknown[])=>{calls.push(['seeDead',...a]);return true;},
   setPedChrisCriminal:(...a:unknown[])=>{calls.push(['chris',...a]);},
   setPedIgnoreHeightDifferenceFollowingNodes:(...a:unknown[])=>{calls.push(['height',...a]);},
   setVehicleAlwaysCreateSkids:(...a:unknown[])=>{calls.push(['skids',...a]);},
   setPedAnimPlayingFlag:(...a:unknown[])=>{calls.push(['anim',...a]);},
   removePedFromCarMaintainPosition:(...a:unknown[])=>{calls.push(['out',...a]);},
   getRidOfPlayerProstitute:()=>{calls.push(['prostitute']);},
  } as unknown as Partial<ScmWorldCommands>;
  const {thread}=run(world,undefined,
   instruction(scmOpcode('IS_CHAR_MALE'),[int(PED)]),
   instruction(scmOpcode('HAS_CHAR_BEEN_DAMAGED_BY_CAR'),[int(PED),int(CAR)]),
   instruction(scmOpcode('CAN_CHAR_SEE_DEAD_CHAR'),[int(PED),int(8)]),
   instruction(scmOpcode('SET_CHAR_IS_CHRIS_CRIMINAL'),[int(PED),int(1)]),
   instruction(scmOpcode('IGNORE_HEIGHT_DIFFERENCE_FOLLOWING_NODES'),[int(PED),int(1)]),
   instruction(scmOpcode('SET_CAR_ALWAYS_CREATE_SKIDS'),[int(CAR),int(1)]),
   instruction(scmOpcode('SET_CHAR_ANIM_PLAYING_FLAG'),[int(PED),'RUN',int(1)]),
   instruction(scmOpcode('REMOVE_CHAR_FROM_CAR_MAINTAIN_POSITION'),[int(PED),int(CAR)]),
   instruction(scmOpcode('GET_RID_OF_PLAYER_PROSTITUTE'),[]));
  expect(calls).toEqual([
   ['damaged',PED,CAR],['seeDead',PED],['chris',PED,true],['height',PED,true],['skids',CAR,true],
   ['anim',PED,'RUN',true],['out',PED,CAR],['prostitute'],
  ]);
  expect(thread.condition).toBe(true);
 });

 test('an object playing no animation leaves the variable at nothing',()=>{
  expect(run({objectAnimProgress:()=>0.75},undefined,
   instruction(scmOpcode('GET_OBJECT_ANIM_CURRENT_TIME'),[int(OBJECT),'GARAGE',gvar(40)])).readFloat(40)).toBeCloseTo(0.75,6);
  expect(run({objectAnimProgress:()=>undefined},undefined,
   instruction(scmOpcode('GET_OBJECT_ANIM_CURRENT_TIME'),[int(OBJECT),'GARAGE',gvar(40)])).readFloat(40)).toBe(0);
 });
});

describe('the last of the camera commands',()=>{
 test('the zoom reaches the camera the active mode names, and no other',()=>{
  for(const [mode,field] of [[MODE_FOLLOWPED,'zoomFollowPed'],[MODE_CAM_ON_A_STRING,'zoomCamOnAString']] as const){
   const game=new ScmGameState();
   run({activeCameraMode:()=>mode},game,instruction(scmOpcode('SET_CAMERA_ZOOM'),[int(2)]));
   expect(game.camera[field]).toBe(2);
  }
  // Any other mode takes neither.
  const other=new ScmGameState();
  run({activeCameraMode:()=>MODE_FIXED},other,instruction(scmOpcode('SET_CAMERA_ZOOM'),[int(2)]));
  expect([other.camera.zoomFollowPed,other.camera.zoomCamOnAString]).toEqual([0,0]);
 });

 test('the vehicle camera tweak resets to ones rather than to nothing',()=>{
  const game=new ScmGameState();
  expect(game.camera.cameraTweak).toEqual({model:-1,distance:1,altitude:1,angle:0});
  run({},game,instruction(scmOpcode('SET_VEHICLE_CAMERA_TWEAK'),[int(411),float(2),float(3),float(0.5)]));
  expect(game.camera.cameraTweak).toEqual({model:411,distance:2,altitude:3,angle:0.5});
  run({},game,instruction(scmOpcode('RESET_VEHICLE_CAMERA_TWEAK'),[]));
  expect(game.camera.cameraTweak).toEqual({model:-1,distance:1,altitude:1,angle:0});
 });

 test('the two flags the camera keeps are set by their own commands',()=>{
  const game=new ScmGameState();
  run({},game,instruction(scmOpcode('CAMERA_PERSIST_FOV'),[int(1)]),
   instruction(scmOpcode('ALLOW_FIXED_CAMERA_COLLISION'),[int(1)]));
  expect(game.camera).toMatchObject({blockZoom:true,allowFixedCameraCollision:true});
 });

 test('the unfixed command gives its vertical angle first, as the source assigns them',()=>{
  const calls:unknown[]=[];
  run({setActiveCameraAngles:(...args)=>{calls.push(args);}},undefined,
   instruction(scmOpcode('SET_CAMERA_POSITION_UNFIXED'),[float(0.25),float(1.5)]));
  expect(calls).toEqual([[0.25,1.5]]);
 });

 test('the field of view and the debug camera are read from the host',()=>{
  expect(run({activeCameraFov:()=>70},undefined,
   instruction(scmOpcode('GET_CAMERA_FOV'),[gvar(40)])).readFloat(40)).toBeCloseTo(70,5);
  const world={debugCameraSource:()=>({x:1,y:2,z:3}),debugCameraFront:()=>({x:0,y:0,z:1})};
  const source=run(world,undefined,instruction(scmOpcode('GET_DEBUG_CAMERA_COORDINATES'),[gvar(40),gvar(44),gvar(48)]));
  expect([source.readFloat(40),source.readFloat(44),source.readFloat(48)]).toEqual([1,2,3]);
  const at=run(world,undefined,instruction(scmOpcode('GET_DEBUG_CAMERA_POINT_AT'),[gvar(40),gvar(44),gvar(48)]));
  expect([at.readFloat(40),at.readFloat(44),at.readFloat(48)]).toEqual([1,2,4]);
 });

 test('the in-car camera mode reads back the zoom its own setter wrote',()=>{
  const game=new ScmGameState();
  run({},game,instruction(scmOpcode('SET_PLAYER_IN_CAR_CAMERA_MODE'),[int(3)]));
  expect(run({},game,instruction(scmOpcode('GET_PLAYER_IN_CAR_CAMERA_MODE'),[gvar(40)])).readInt(40)).toBe(3);
 });

 test('the camera bump and the in-front commands reach the host',()=>{
  const calls:unknown[]=[];
  const world={
   doCameraBump:(...a:unknown[])=>{calls.push(['bump',...a]);},
   setCameraInFrontOfPlayer:()=>{calls.push(['player']);},
   setCameraInFrontOfPed:(...a:unknown[])=>{calls.push(['ped',...a]);},
  } as unknown as Partial<ScmWorldCommands>;
  run(world,undefined,instruction(scmOpcode('DO_CAMERA_BUMP'),[float(1),float(2)]),
   instruction(scmOpcode('SET_CAMERA_IN_FRONT_OF_PLAYER'),[]),
   instruction(scmOpcode('SET_CAMERA_IN_FRONT_OF_CHAR'),[int(PED)]));
  expect(calls).toEqual([['bump',1,2],['player'],['ped',PED]]);
 });

 test('the subtitles-before-fade switch is the script’s own flag',()=>{
  const game=new ScmGameState();
  run({},game,instruction(scmOpcode('DRAW_SUBTITLES_BEFORE_FADE'),[int(0)]));
  expect(game.drawSubtitlesBeforeFade).toBe(false);
  run({},game,instruction(scmOpcode('DRAW_SUBTITLES_BEFORE_FADE'),[int(1)]));
  expect(game.drawSubtitlesBeforeFade).toBe(true);
 });
});

describe('the four commands the reference documents but does not register',()=>{
 test('a passenger is created into the seat the script names, not the driver’s',()=>{
  const calls:unknown[]=[];
  const {readInt}=run({createCharInsideCar:(...args:unknown[])=>{calls.push(args);return 42;}},undefined,
   instruction(scmOpcode('CREATE_CHAR_AS_PASSENGER'),[int(CAR),int(4),int(287),int(2),gvar(40)]));
  expect(calls).toEqual([[CAR,4,287,2]]);
  expect(readInt(40)).toBe(42);
 });

 test('a random char is created at the point the script gives, with the game choosing the model',()=>{
  const calls:unknown[]=[];
  const {readInt}=run({createRandomChar:(...args:unknown[])=>{calls.push(args);return 43;}},undefined,
   instruction(scmOpcode('CREATE_RANDOM_CHAR'),[float(10),float(20),float(3),gvar(40)]));
  expect(calls).toEqual([[10,20,3]]);
  expect(readInt(40)).toBe(43);
 });

 test('the look task is cleared for the ped the command names',()=>{
  const calls:number[]=[];
  run({clearPedLookAt:(handle:number)=>{calls.push(handle);}},undefined,
   instruction(scmOpcode('CLEAR_LOOK_AT'),[int(PED)]));
  expect(calls).toEqual([PED]);
 });

 test('group membership is asked of the pair the command names',()=>{
  const asked:number[][]=[];
  const world={pedIsInGroup:(handle:number,group:number)=>{asked.push([handle,group]);return group===3;}};
  expect(run(world,undefined,instruction(scmOpcode('IS_GROUP_MEMBER'),[int(PED),int(3)])).thread.condition).toBe(true);
  expect(run(world,undefined,instruction(scmOpcode('IS_GROUP_MEMBER'),[int(PED),int(4)])).thread.condition).toBe(false);
  expect(asked).toEqual([[PED,3],[PED,4]]);
 });
});
