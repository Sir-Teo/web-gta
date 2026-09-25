import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {scmOpcode} from '../src/engine/scmOpcodes';

const CODE=512;
function instruction(opcode:number,operands:readonly (readonly [number,number])[]){
 const out:number[]=[opcode&0xff,opcode>>8&0xff];
 for(const [type,value] of operands){
  const bytes=new Uint8Array(4),view=new DataView(bytes.buffer);
  if(type===1){view.setInt32(0,value,true);out.push(1,...bytes);}
  else if(type===6){view.setFloat32(0,value,true);out.push(6,...bytes);}
  else {view.setUint16(0,value,true);out.push(type,bytes[0],bytes[1]);}
 }
 return out;
}
const int=(value:number)=>[1,value] as const;
const gvar=(offset:number)=>[2,offset] as const;
function run(world:Partial<ScmWorldCommands>,game=new ScmGameState(),...instructions:number[][]){
 const space=new Uint8Array(2048);space.set(instructions.flat(),CODE);
 const host:ScmThreadHost={startScript(){},game,world:{fade(){},...world} as ScmWorldCommands};
 const thread=new ScmThread(space,CODE,0,undefined,host);
 try{thread.run(0,16);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 const view=new DataView(space.buffer);
 return {thread,game,int:(offset:number)=>view.getInt32(offset,true),float:(offset:number)=>view.getFloat32(offset,true)};
}
const PED=7,CAR=9;

describe('the ped state a script reads and writes',()=>{
 test('a ped in a car reads the car’s heading',()=>{
  const {float}=run({pedHeading:()=>271.5},undefined,
   instruction(scmOpcode('GET_CHAR_HEADING'),[int(PED),gvar(40)]));
  expect(float(40)).toBeCloseTo(271.5,4);
 });

 test('the three simple flags are stored exactly as the command gives them',()=>{
  const set:[string,boolean][]=[];
  run({setPedSimpleFlag:(_h:number,flag:string,value:boolean)=>{set.push([flag,value]);}},undefined,
   instruction(scmOpcode('SET_CHAR_BLEEDING'),[int(PED),int(1)]),
   instruction(scmOpcode('SET_CHAR_DROWNS_IN_WATER'),[int(PED),int(0)]),
   instruction(scmOpcode('SET_CHAR_NEVER_LEAVES_GROUP'),[int(PED),int(1)]));
  expect(set).toEqual([['bleeding',true],['drownsInWater',false],['neverLeavesGroup',true]]);
 });

 test('the ped’s own speech pair can stop what it is saying, unlike the blanket form',()=>{
  const calls:unknown[]=[];
  run({disablePedSpeech:(...args)=>{calls.push(['disable',...args]);},enablePedSpeech:(...args)=>{calls.push(['enable',...args]);}},
   undefined,
   instruction(scmOpcode('DISABLE_CHAR_SPEECH'),[int(PED),int(1)]),
   instruction(scmOpcode('ENABLE_CHAR_SPEECH'),[int(PED)]));
  expect(calls).toEqual([['disable',PED,true],['enable',PED]]);
 });

 test('a ped carrying no weapon of that type has no ammo of it',()=>{
  const carrying=run({pedWeaponAmmo:()=>42},undefined,
   instruction(scmOpcode('GET_AMMO_IN_CHAR_WEAPON'),[int(PED),int(22),gvar(40)]));
  expect(carrying.int(40)).toBe(42);
  const empty=run({pedWeaponAmmo:()=>undefined},undefined,
   instruction(scmOpcode('GET_AMMO_IN_CHAR_WEAPON'),[int(PED),int(22),gvar(40)]));
  expect(empty.int(40)).toBe(0);
 });

 test('the photograph question lowers the flag as it answers, so a second ask says no',()=>{
  let photographed=true;
  const world={takePedPhotographedFlag:()=>{const was=photographed;photographed=false;return was;}};
  expect(run(world,undefined,instruction(scmOpcode('HAS_CHAR_BEEN_PHOTOGRAPHED'),[int(PED)])).thread.condition).toBe(true);
  expect(run(world,undefined,instruction(scmOpcode('HAS_CHAR_BEEN_PHOTOGRAPHED'),[int(PED)])).thread.condition).toBe(false);
 });

 test('the car a ped is using covers the one it rides and the one it is climbing into',()=>{
  const riding=run({pedCarInUse:()=>CAR},undefined,
   instruction(scmOpcode('GET_CAR_CHAR_IS_USING'),[int(PED),gvar(40)]));
  expect(riding.int(40)).toBe(CAR);
  const walking=run({pedCarInUse:()=>undefined},undefined,
   instruction(scmOpcode('GET_CAR_CHAR_IS_USING'),[int(PED),gvar(40)]));
  expect(walking.int(40)).toBe(0);
 });

 test('an empty passenger seat reads -1',()=>{
  const asked:number[][]=[];
  const taken=run({pedInPassengerSeat:(vehicle:number,seat:number)=>{asked.push([vehicle,seat]);return 5;}},undefined,
   instruction(scmOpcode('GET_CHAR_IN_CAR_PASSENGER_SEAT'),[int(CAR),int(2),gvar(40)]));
  expect(taken.int(40)).toBe(5);
  expect(asked).toEqual([[CAR,2]]);
  const free=run({pedInPassengerSeat:()=>undefined},undefined,
   instruction(scmOpcode('GET_CHAR_IN_CAR_PASSENGER_SEAT'),[int(CAR),int(2),gvar(40)]));
  expect(free.int(40)).toBe(-1);
 });

 test('setting a ped alight starts a script fire where it stands',()=>{
  const started=run({pedPosition:()=>({x:10,y:20,z:3})},undefined,
   instruction(scmOpcode('START_CHAR_FIRE'),[int(PED),gvar(40)]));
  const {game}=started,handle=started.int(40);
  expect(handle).toBeGreaterThan(0);
  const fire=game.fires.fires.find(entry=>entry.active);
  expect(fire).toMatchObject({position:{x:10,y:20,z:3},strength:0.8,createdByScript:true,generationsAllowed:1});
 });

 test('the remaining commands reach the host with what the script named',()=>{
  const calls:unknown[]=[];
  const world={
   setPedVisible:(...args:unknown[])=>{calls.push(['visible',...args]);},
   removeAllPedWeapons:(...args:unknown[])=>{calls.push(['disarm',...args]);},
   setPedAmmo:(...args:unknown[])=>{calls.push(['ammo',...args]);},
   setPedMoney:(...args:unknown[])=>{calls.push(['money',...args]);},
   warpPedIntoCarAsPassenger:(...args:unknown[])=>{calls.push(['warp',...args]);},
   pedIsInWater:()=>true,
  } as unknown as Partial<ScmWorldCommands>;
  const {thread}=run(world,undefined,
   instruction(scmOpcode('SET_CHAR_VISIBLE'),[int(PED),int(0)]),
   instruction(scmOpcode('REMOVE_ALL_CHAR_WEAPONS'),[int(PED)]),
   instruction(scmOpcode('SET_CHAR_AMMO'),[int(PED),int(22),int(60)]),
   instruction(scmOpcode('SET_CHAR_MONEY'),[int(PED),int(250)]),
   instruction(scmOpcode('WARP_CHAR_INTO_CAR_AS_PASSENGER'),[int(PED),int(CAR),int(1)]),
   instruction(scmOpcode('REMOVE_STUCK_CAR_CHECK'),[int(CAR)]),
   instruction(scmOpcode('IS_CHAR_IN_WATER'),[int(PED)]));
  expect(calls).toEqual([
   ['visible',PED,false],['disarm',PED],['ammo',PED,22,60],['money',PED,250],
   ['warp',PED,CAR,1],
  ]);
  expect(thread.condition).toBe(true);
 });
});
