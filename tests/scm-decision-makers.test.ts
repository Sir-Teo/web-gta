import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {COUNT_GAME_DECISION_MAKERS,PED_DECISION_MAKER_NAMES,ScmDecisionMakers,TOTAL_DECISION_MAKERS} from '../src/engine/ScmDecisionMakers';
import {scmOpcode} from '../src/engine/scmOpcodes';

const CODE=512;
function instruction(opcode:number,operands:readonly (readonly [number,number])[]){
 const out:number[]=[opcode&0xff,opcode>>8&0xff];
 for(const [type,value] of operands){
  const bytes=new Uint8Array(4),view=new DataView(bytes.buffer);
  if(type===1){view.setInt32(0,value,true);out.push(1,...bytes);}
  else {view.setUint16(0,value,true);out.push(type,bytes[0],bytes[1]);}
 }
 return out;
}
const int=(value:number)=>[1,value] as const;
const gvar=(offset:number)=>[2,offset] as const;
function run(game:ScmGameState,missionCleanup:boolean,...instructions:number[][]){
 const space=new Uint8Array(2048);space.set(instructions.flat(),CODE);
 const host:ScmThreadHost={startScript(){},game,world:{fade(){}} as ScmWorldCommands};
 const thread=new ScmThread(space,CODE,0,undefined,host);
 thread.usesMissionCleanup=missionCleanup;
 try{thread.run(0,16);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return {thread,global:(offset:number)=>new DataView(space.buffer).getInt32(offset,true)};
}

describe('the decision makers a script loads',()=>{
 test('a load takes the first slot after the built-in ones and reads that type’s own file',()=>{
  const game=new ScmGameState();
  const {global}=run(game,false,instruction(scmOpcode('LOAD_CHAR_DECISION_MAKER'),[int(1),gvar(40)]));
  const handle=global(40);
  expect(ScmDecisionMakers.indexOf(handle)).toBe(COUNT_GAME_DECISION_MAKERS);
  expect(game.decisionMakers.get(handle)).toMatchObject({type:1,file:'m_norm.ped',forMission:false,loaded:true});
 });

 test('each type names its own file, and a type outside the table loads nothing',()=>{
  PED_DECISION_MAKER_NAMES.forEach((name,type)=>{
   expect(ScmDecisionMakers.fileFor(type,false),name).toBe(name);
  });
  expect(ScmDecisionMakers.fileFor(PED_DECISION_MAKER_NAMES.length,false)).toBeUndefined();
  expect(ScmDecisionMakers.fileFor(0,true)).toBe('MISSION.grp');
  const game=new ScmGameState();
  const {global}=run(game,false,instruction(scmOpcode('LOAD_CHAR_DECISION_MAKER'),[int(99),gvar(40)]));
  expect(game.decisionMakers.get(global(40))).toMatchObject({file:'',loaded:false});
 });

 test('a thread that uses mission cleanup loads one that goes with its mission',()=>{
  const game=new ScmGameState();
  run(game,true,instruction(scmOpcode('LOAD_CHAR_DECISION_MAKER'),[int(2),gvar(40)]));
  run(game,false,instruction(scmOpcode('LOAD_CHAR_DECISION_MAKER'),[int(3),gvar(44)]));
  expect(game.decisionMakers.count).toBe(2);
  game.decisionMakers.cleanUpMissionMakers();
  expect(game.decisionMakers.count).toBe(1);
  expect(game.decisionMakers.all[0]).toMatchObject({type:3,forMission:false});
 });

 test('handles do not collide when a slot is freed and taken again',()=>{
  const game=new ScmGameState();
  const first=run(game,false,instruction(scmOpcode('LOAD_CHAR_DECISION_MAKER'),[int(1),gvar(40)])).global(40);
  run(game,false,instruction(scmOpcode('REMOVE_DECISION_MAKER'),[int(first)]));
  expect(game.decisionMakers.get(first)).toBeUndefined();
  const second=run(game,false,instruction(scmOpcode('LOAD_CHAR_DECISION_MAKER'),[int(4),gvar(40)])).global(40);
  expect(ScmDecisionMakers.indexOf(second)).toBe(ScmDecisionMakers.indexOf(first));
  expect(game.decisionMakers.get(second)).toMatchObject({type:4,file:'m_steal.ped'});
  // The slot's reference index has moved on: the old handle names nothing.
  expect(second).not.toBe(first);expect(game.decisionMakers.actualIndex(first)).toBe(-1);
 });

 test('the table holds ten of its own beyond the built-in ones and refuses an eleventh',()=>{
  const game=new ScmGameState();
  for(let index=COUNT_GAME_DECISION_MAKERS;index<TOTAL_DECISION_MAKERS;index++)game.decisionMakers.load(1,false);
  expect(game.decisionMakers.count).toBe(TOTAL_DECISION_MAKERS-COUNT_GAME_DECISION_MAKERS);
  expect(()=>game.decisionMakers.load(1,false)).toThrow(/slot/);
 });

 test('the group form loads from the group table rather than the ped one',()=>{
  const game=new ScmGameState();
  const {global}=run(game,false,instruction(scmOpcode('LOAD_GROUP_DECISION_MAKER'),[int(0),gvar(40)]));
  expect(game.decisionMakers.get(global(40))).toMatchObject({group:true,file:'MISSION.grp'});
 });
});

describe('DOES_DECISION_MAKER_EXIST',()=>{
 test('a copy into a variable that already names a live decision maker keeps that one (iOS 0x100203cec)',()=>{
  // dealer.scm: COPY_SHARED_CHAR_DECISION_MAKER 65539 into the global every dealer's brain shares.
  const game=new ScmGameState(),seeded:number[]=[],space=new Uint8Array(2048),globals=new DataView(space.buffer);
  const copy=(template=65539,global=40)=>{
   space.set(instruction(scmOpcode('COPY_SHARED_CHAR_DECISION_MAKER'),[int(template),gvar(global)]),CODE);
   const thread=new ScmThread(space,CODE,0,undefined,{startScript(){},game,world:{fade(){},seedDecisionMaker:(handle:number)=>{seeded.push(handle);}} as unknown as ScmWorldCommands});
   try{thread.run(0,4);}catch(error){if(!String(error).match(/watchdog|opcode|Unknown/))throw error;}
   return globals.getInt32(global,true);
  };
  const first=copy();
  for(let i=0;i<30;i++)expect(copy()).toBe(first);
  expect(game.decisionMakers.count).toBe(1);expect(seeded).toEqual([first]);
  // Freed, the global names nothing live, so the next brain makes a new copy.
  game.decisionMakers.remove(first);
  const next=copy();expect(next).not.toBe(first);expect(game.decisionMakers.count).toBe(1);expect(seeded).toEqual([first,next]);
  // bouncer.scm and copsit.scm copy one template into different globals: each has its own, and freeing one leaves
  // the other.
  const bouncer=copy(65537,44),copsit=copy(65537,48);
  expect(copsit).not.toBe(bouncer);expect(game.decisionMakers.count).toBe(3);
  game.decisionMakers.remove(bouncer);expect(game.decisionMakers.actualIndex(copsit)).not.toBe(-1);
 });

 test('the game’s own makers by their handle, a script’s while its slot still holds it, and -1 never',()=>{
  const game=new ScmGameState();
  const handle=run(game,false,instruction(scmOpcode('LOAD_CHAR_DECISION_MAKER'),[int(1),gvar(40)])).global(40);
  // IF DOES_DECISION_MAKER_EXIST handle; SET_VAR_INT 44 1.
  const exists=(dm:number)=>{
   const space=new Uint8Array(2048),view=new DataView(space.buffer);
   space.set([...instruction(scmOpcode('DOES_DECISION_MAKER_EXIST'),[int(dm)]),...instruction(scmOpcode('GOTO_IF_FALSE'),[int(CODE+64)]),
    ...instruction(scmOpcode('SET_VAR_INT'),[gvar(44),int(1)])],CODE);
   const thread=new ScmThread(space,CODE,0,undefined,{startScript(){},game,world:{fade(){}} as ScmWorldCommands});
   try{thread.run(0,4);}catch(error){if(!String(error).match(/watchdog|opcode|Unknown/))throw error;}
   return view.getInt32(44,true)===1;
  };
  expect(exists(handle)).toBe(true);
  expect(exists(65537)).toBe(true);
  // A bare index is not a handle: its reference half (0) is not the slot's.
  expect(exists(0)).toBe(false);
  expect(exists(-1)).toBe(false);
  game.decisionMakers.remove(handle);
  expect(exists(handle)).toBe(false);
 });
});
