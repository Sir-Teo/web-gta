import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
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
 const space=new Uint8Array(2048);space.set(instructions.flat(),CODE);
 const host:ScmThreadHost={startScript(){},game:new ScmGameState(),world:{fade(){},...world} as ScmWorldCommands};
 const thread=new ScmThread(space,CODE,0,undefined,host);
 try{thread.run(0,16);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 const view=new DataView(space.buffer);
 return {thread,readInt:(offset:number)=>view.getInt32(offset,true),readFloat:(offset:number)=>view.getFloat32(offset,true)};
}
const PED=7,OBJECT=9;

describe('what the player is aiming at',()=>{
 const asking=(target?:{kind:'ped'|'vehicle'|'object';handle:number})=>({playerTarget:()=>target});
 test('aiming at nothing answers no to all three questions',()=>{
  const world=asking();
  expect(run(world,instruction(scmOpcode('IS_PLAYER_TARGETTING_ANYTHING'),[int(0)])).thread.condition).toBe(false);
  expect(run(world,instruction(scmOpcode('IS_PLAYER_TARGETTING_CHAR'),[int(0),int(PED)])).thread.condition).toBe(false);
  expect(run(world,instruction(scmOpcode('IS_PLAYER_TARGETTING_OBJECT'),[int(0),int(OBJECT)])).thread.condition).toBe(false);
 });
 test('a ped target answers the ped question and not the object one',()=>{
  const world=asking({kind:'ped',handle:PED});
  expect(run(world,instruction(scmOpcode('IS_PLAYER_TARGETTING_ANYTHING'),[int(0)])).thread.condition).toBe(true);
  expect(run(world,instruction(scmOpcode('IS_PLAYER_TARGETTING_CHAR'),[int(0),int(PED)])).thread.condition).toBe(true);
  expect(run(world,instruction(scmOpcode('IS_PLAYER_TARGETTING_CHAR'),[int(0),int(PED+1)])).thread.condition).toBe(false);
  expect(run(world,instruction(scmOpcode('IS_PLAYER_TARGETTING_OBJECT'),[int(0),int(PED)])).thread.condition).toBe(false);
 });
 test('an object target answers the object question',()=>{
  const world=asking({kind:'object',handle:OBJECT});
  expect(run(world,instruction(scmOpcode('IS_PLAYER_TARGETTING_OBJECT'),[int(0),int(OBJECT)])).thread.condition).toBe(true);
  expect(run(world,instruction(scmOpcode('IS_PLAYER_TARGETTING_CHAR'),[int(0),int(OBJECT)])).thread.condition).toBe(false);
 });
});

describe('the boxes a script tests',()=>{
 test('an explosion box is sorted before it is tested, whichever way the corners come',()=>{
  const asked:unknown[]=[];
  const world={explosionInArea:(...args:unknown[])=>{asked.push(args);return true;}};
  run(world,instruction(scmOpcode('IS_EXPLOSION_IN_AREA'),
   [int(3),float(10),float(20),float(30),float(0),float(5),float(8)]));
  expect(asked).toEqual([[3,{x:0,y:5,z:8},{x:10,y:20,z:30}]]);
 });

 test('a ped counts as shooting in an area only when it is both shooting and inside',()=>{
  const at=(x:number,y:number,shooting:boolean)=>({pedPosition:()=>({x,y,z:0}),pedIsShooting:()=>shooting});
  const operands=[int(PED),float(0),float(0),float(10),float(10),int(0)] as const;
  expect(run(at(5,5,true),instruction(scmOpcode('IS_CHAR_SHOOTING_IN_AREA'),operands)).thread.condition).toBe(true);
  expect(run(at(5,5,false),instruction(scmOpcode('IS_CHAR_SHOOTING_IN_AREA'),operands)).thread.condition).toBe(false);
  expect(run(at(50,5,true),instruction(scmOpcode('IS_CHAR_SHOOTING_IN_AREA'),operands)).thread.condition).toBe(false);
 });

 test('the stuck-car check without a warp leaves its four switches at nothing',()=>{
  const calls:unknown[]=[];
  const world={addStuckCarCheck:(...args:unknown[])=>{calls.push(args);}};
  run(world,instruction(scmOpcode('ADD_STUCK_CAR_CHECK'),[int(9),float(2.5),int(4000)]),
   instruction(scmOpcode('ADD_STUCK_CAR_CHECK_WITH_WARP'),
    [int(9),float(3),int(5000),int(1),int(0),int(1),int(4)]));
  expect(calls).toEqual([
   [9,2.5,4000,false,{stuck:false,flipped:false,inWater:false,nodesToCheck:0}],
   [9,3,5000,true,{stuck:true,flipped:false,inWater:true,nodesToCheck:4}],
  ]);
 });
});

describe('the last of the ped and object commands',()=>{
 test('the health question compares with greater or equal, despite its name',()=>{
  const world={pedHealth:()=>100};
  expect(run(world,instruction(scmOpcode('IS_CHAR_HEALTH_GREATER'),[int(PED),float(100)])).thread.condition).toBe(true);
  expect(run(world,instruction(scmOpcode('IS_CHAR_HEALTH_GREATER'),[int(PED),float(101)])).thread.condition).toBe(false);
 });

 test('the dead ped’s point and its current weapon are read from the host',()=>{
  const coords=run({deadPedCoordinates:()=>({x:1,y:2,z:3})},
   instruction(scmOpcode('GET_DEAD_CHAR_COORDINATES'),[int(PED),gvar(40),gvar(44),gvar(48)]));
  expect([coords.readFloat(40),coords.readFloat(44),coords.readFloat(48)]).toEqual([1,2,3]);
  const weapon=run({pedActiveWeapon:()=>({type:22,melee:false})},
   instruction(scmOpcode('GET_CURRENT_CHAR_WEAPON'),[int(PED),gvar(40)]));
  expect(weapon.readInt(40)).toBe(22);
 });

 test('the camera takes a ped only when it is the player’s own',()=>{
  const calls:unknown[]=[];
  const world=(isPlayer:boolean)=>({pedIsPlayer:()=>isPlayer,pointCameraAtPed:(...args:unknown[])=>{calls.push(args);}});
  run(world(true),instruction(scmOpcode('POINT_CAMERA_AT_CHAR'),[int(PED),int(15),int(1)]));
  run(world(false),instruction(scmOpcode('POINT_CAMERA_AT_CHAR'),[int(PED),int(15),int(1)]));
  expect(calls).toEqual([[PED,true,15,1],[PED,false,15,1]]);
 });

 test('attaching a ped to an object gives the angle limit in radians',()=>{
  const calls:unknown[]=[];
  run({attachPedToObject:(...args:unknown[])=>{calls.push(args);}},
   instruction(scmOpcode('ATTACH_CHAR_TO_OBJECT'),
    [int(PED),int(OBJECT),float(1),float(2),float(3),int(0),float(180),int(22)]));
  expect(calls.length).toBe(1);
  const [handle,object,offset,position,angleLimit,weapon]=calls[0] as [number,number,unknown,number,number,number];
  expect([handle,object,position,weapon]).toEqual([PED,OBJECT,0,22]);
  expect(offset).toEqual({x:1,y:2,z:3});
  expect(angleLimit).toBeCloseTo(Math.PI,6);
 });

 test('the object animation commands name the animation the script gave',()=>{
  const calls:unknown[]=[];
  const world={
   objectIsPlayingAnim:(...args:unknown[])=>{calls.push(['playing',...args]);return true;},
   setObjectAnimSpeed:(...args:unknown[])=>{calls.push(['speed',...args]);},
   setObjectAnimProgress:(...args:unknown[])=>{calls.push(['progress',...args]);},
  } as unknown as Partial<ScmWorldCommands>;
  const {thread}=run(world,
   instruction(scmOpcode('IS_OBJECT_PLAYING_ANIM'),[int(OBJECT),'GARAGE']),
   instruction(scmOpcode('SET_OBJECT_ANIM_SPEED'),[int(OBJECT),'GARAGE',float(2)]),
   instruction(scmOpcode('SET_OBJECT_ANIM_CURRENT_TIME'),[int(OBJECT),'GARAGE',float(0.5)]));
  expect(calls).toEqual([['playing',OBJECT,'GARAGE'],['speed',OBJECT,'GARAGE',2],['progress',OBJECT,'GARAGE',0.5]]);
  expect(thread.condition).toBe(true);
 });
});
