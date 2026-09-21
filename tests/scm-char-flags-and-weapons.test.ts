import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {scmOpcode} from '../src/engine/scmOpcodes';

/** eWeaponType's tail, counted from the enum: the unidentified type and the two wildcards. */
const WEAPON_UNARMED=0,WEAPON_BAT=5,WEAPON_PISTOL=22,WEAPON_UNIDENTIFIED=55,WEAPON_ANYMELEE=56,WEAPON_ANYWEAPON=57;
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
const gvar=(offset:number)=>[2,offset] as const;
function run(world:Partial<ScmWorldCommands>,...instructions:number[][]){
 const space=new Uint8Array(2048);space.set(instructions.flat(),CODE);
 const host:ScmThreadHost={startScript(){},game:new ScmGameState(),world:{fade(){},...world} as ScmWorldCommands};
 const thread=new ScmThread(space,CODE,0,undefined,host);
 try{thread.run(0,16);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 const view=new DataView(space.buffer);
 return {thread,global:(offset:number)=>view.getInt32(offset,true),globalFloat:(offset:number)=>view.getFloat32(offset,true)};
}
const PED=7;

describe('the weapons a script asks a ped about',()=>{
 test('carrying a weapon is asked of every slot',()=>{
  const asked:number[][]=[];
  const world={pedHasWeapon:(handle:number,type:number)=>{asked.push([handle,type]);return type===WEAPON_PISTOL;}};
  expect(run(world,instruction(scmOpcode('HAS_CHAR_GOT_WEAPON'),[int(PED),int(WEAPON_PISTOL)])).thread.condition).toBe(true);
  expect(run(world,instruction(scmOpcode('HAS_CHAR_GOT_WEAPON'),[int(PED),int(WEAPON_BAT)])).thread.condition).toBe(false);
  expect(asked).toEqual([[PED,WEAPON_PISTOL],[PED,WEAPON_BAT]]);
 });

 test('the current weapon matches by type, and any melee matches a melee one',()=>{
  const holdingBat={pedActiveWeapon:()=>({type:WEAPON_BAT,melee:true})};
  const holdingPistol={pedActiveWeapon:()=>({type:WEAPON_PISTOL,melee:false})};
  const ask=(world:Partial<ScmWorldCommands>,weapon:number)=>
   run(world,instruction(scmOpcode('IS_CURRENT_CHAR_WEAPON'),[int(PED),int(weapon)])).thread.condition;
  expect(ask(holdingBat,WEAPON_BAT)).toBe(true);
  expect(ask(holdingBat,WEAPON_ANYMELEE)).toBe(true);
  expect(ask(holdingPistol,WEAPON_ANYMELEE)).toBe(false);
  expect(ask(holdingPistol,WEAPON_PISTOL)).toBe(true);
  expect(ask(holdingPistol,WEAPON_UNARMED)).toBe(false);
 });

 test('the damage question treats its two wildcards apart from a named weapon',()=>{
  const ask=(last:{type:number;melee:boolean}|undefined,weapon:number)=>
   run({pedLastWeaponDamage:()=>last},instruction(scmOpcode('HAS_CHAR_BEEN_DAMAGED_BY_WEAPON'),
    [int(PED),int(weapon)])).thread.condition;
  expect(ask({type:WEAPON_PISTOL,melee:false},WEAPON_PISTOL)).toBe(true);
  expect(ask({type:WEAPON_PISTOL,melee:false},WEAPON_BAT)).toBe(false);
  expect(ask({type:WEAPON_PISTOL,melee:false},WEAPON_ANYWEAPON)).toBe(true);
  expect(ask({type:WEAPON_PISTOL,melee:false},WEAPON_ANYMELEE)).toBe(false);
  expect(ask({type:WEAPON_BAT,melee:true},WEAPON_ANYMELEE)).toBe(true);
  // A ped damaged by nothing identifiable has not been damaged by any weapon.
  expect(ask({type:WEAPON_UNIDENTIFIED,melee:false},WEAPON_ANYWEAPON)).toBe(false);
  // A handle naming no ped answers false, whatever is asked.
  expect(ask(undefined,WEAPON_ANYWEAPON)).toBe(false);
 });
});

describe('the ped flags and questions a script reaches',()=>{
 test('three of the four flags are stored the other way round from the command',()=>{
  const set:[string,boolean][]=[];
  const world={setPedFlag:(_handle:number,flag:string,value:boolean)=>{set.push([flag,value]);}};
  run(world,
   instruction(scmOpcode('SET_CHAR_ALLOWED_TO_DUCK'),[int(PED),int(1)]),
   instruction(scmOpcode('SET_CHAR_DROPS_WEAPONS_WHEN_DEAD'),[int(PED),int(1)]),
   instruction(scmOpcode('SET_CHAR_STAY_IN_CAR_WHEN_JACKED'),[int(PED),int(1)]),
   instruction(scmOpcode('SET_CHAR_GET_OUT_UPSIDE_DOWN_CAR'),[int(PED),int(1)]));
  expect(set).toEqual([
   ['notAllowedToDuck',false],
   ['doesntDropWeaponsWhenDead',false],
   ['stayInCarOnJack',true],
   ['getOutUpsideDownCar',true],
  ]);
 });

 test('each simple question is asked of the ped the command names',()=>{
  const cases:[string,keyof ScmWorldCommands][]=[
   ['IS_CHAR_SHOOTING','pedIsShooting'],['IS_CHAR_ON_SCREEN','pedIsOnScreen'],
   ['IS_CHAR_ON_FOOT','pedIsOnFoot'],['IS_CHAR_SITTING_IN_ANY_CAR','pedIsSittingInAnyCar'],
  ];
  for(const [name,method] of cases){
   const asked:number[]=[];
   const world={[method]:(handle:number)=>{asked.push(handle);return true;}} as Partial<ScmWorldCommands>;
   expect(run(world,instruction(scmOpcode(name),[int(PED)])).thread.condition,name).toBe(true);
   expect(asked,name).toEqual([PED]);
   const off={[method]:()=>false} as Partial<ScmWorldCommands>;
   expect(run(off,instruction(scmOpcode(name),[int(PED)])).thread.condition,name).toBe(false);
  }
 });

 test('shutting a ped up disables its speech, and the all-peds form takes no handle',()=>{
  const one:unknown[]=[],all:boolean[]=[];
  run({setPedSpeechDisabled:(...args)=>{one.push(args);},setAllPedSpeechDisabled:value=>{all.push(value);}},
   instruction(scmOpcode('SHUT_CHAR_UP'),[int(PED),int(1)]),
   instruction(scmOpcode('SHUT_CHAR_UP'),[int(PED),int(0)]),
   instruction(scmOpcode('SHUT_ALL_CHARS_UP'),[int(1)]));
  expect(one).toEqual([[PED,true],[PED,false]]);
  expect(all).toEqual([true]);
 });

 test('an animation the ped is not playing leaves the variable at nothing',()=>{
  const playing=run({pedAnimProgress:()=>0.25},
   instruction(scmOpcode('GET_CHAR_ANIM_CURRENT_TIME'),[int(PED),'WALK',gvar(40)]));
  expect(playing.globalFloat(40)).toBeCloseTo(0.25,6);
  const missing=run({pedAnimProgress:()=>undefined},
   instruction(scmOpcode('GET_CHAR_ANIM_CURRENT_TIME'),[int(PED),'WALK',gvar(40)]));
  expect(missing.globalFloat(40)).toBe(0);
 });

 test('the remaining commands reach the host with what the script named',()=>{
  const calls:unknown[]=[];
  const world={
   setPedCollision:(...args:unknown[])=>{calls.push(['collision',...args]);},
   freezePedPositionAndWaitForCollision:(...args:unknown[])=>{calls.push(['freeze',...args]);},
   removePedFromGroup:(...args:unknown[])=>{calls.push(['ungroup',...args]);},
   removePedElegantly:(...args:unknown[])=>{calls.push(['remove',...args]);},
   explodePedHead:(...args:unknown[])=>{calls.push(['explode',...args]);},
   setPedAnimSpeed:(...args:unknown[])=>{calls.push(['anim',...args]);},
   pedIsInNaviZone:(...args:unknown[])=>{calls.push(['zone',...args]);return true;},
  } as unknown as Partial<ScmWorldCommands>;
  const {thread}=run(world,
   instruction(scmOpcode('SET_CHAR_COLLISION'),[int(PED),int(0)]),
   instruction(scmOpcode('FREEZE_CHAR_POSITION_AND_DONT_LOAD_COLLISION'),[int(PED),int(1)]),
   instruction(scmOpcode('REMOVE_CHAR_FROM_GROUP'),[int(PED)]),
   instruction(scmOpcode('REMOVE_CHAR_ELEGANTLY'),[int(PED)]),
   instruction(scmOpcode('EXPLODE_CHAR_HEAD'),[int(PED)]),
   instruction(scmOpcode('SET_CHAR_ANIM_SPEED'),[int(PED),'RUN',[6,2]]),
   instruction(scmOpcode('IS_CHAR_IN_ZONE'),[int(PED),'LAN']));
  expect(calls).toEqual([
   ['collision',PED,false],['freeze',PED,true],['ungroup',PED],['remove',PED],['explode',PED],
   ['anim',PED,'RUN',2],['zone',PED,'LAN'],
  ]);
  expect(thread.condition).toBe(true);
 });
});
