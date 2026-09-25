import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {CUTSCENE_NONE,TOTAL_SPECIAL_CHARACTERS} from '../src/engine/ScmCutscene';
import {scmOpcode} from '../src/engine/scmOpcodes';

function instruction(opcode:number,operands:readonly (readonly [number,number]|string)[]){
 const out:number[]=[opcode&0xff,opcode>>8&0xff];
 for(const operand of operands){
  if(typeof operand==='string'){out.push(14,operand.length,...[...operand].map(c=>c.charCodeAt(0)));continue;}
  const [type,value]=operand;
  const bytes=new Uint8Array(4),view=new DataView(bytes.buffer);
  if(type===1){view.setInt32(0,value,true);out.push(1,...bytes);}
  else {view.setUint16(0,value,true);out.push(type,bytes[0],bytes[1]);}
 }
 return out;
}
const int=(value:number)=>[1,value] as const;
function run(game:ScmGameState,world:Partial<ScmWorldCommands>,...instructions:number[][]){
 const space=new Uint8Array(2048);space.set(instructions.flat(),0);
 const host:ScmThreadHost={startScript(){},game,world:{fade(){},...world} as ScmWorldCommands};
 const thread=new ScmThread(space,0,0,undefined,host);
 try{thread.run(0,16);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return thread;
}
const op=scmOpcode;

describe('the cutscene a script loads and runs',()=>{
 test('the script’s own loop is load, wait, start, wait, clear',()=>{
  const game=new ScmGameState();const calls:string[]=[];
  const world={loadCutscene:(name:string)=>{calls.push('load '+name);},startCutscene:()=>{calls.push('start');},
   clearCutscene:()=>{calls.push('clear');}};
  run(game,world,instruction(op('LOAD_CUTSCENE'),['INTRO']));
  expect(game.cutscene.name).toBe('INTRO');
  expect(run(game,world,instruction(op('HAS_CUTSCENE_LOADED'),[])).condition).toBe(false);
  // Starting before the data is in does nothing at all.
  run(game,world,instruction(op('START_CUTSCENE'),[]));
  expect(game.cutscene.running).toBe(false);
  game.cutscene.loaded();
  expect(run(game,world,instruction(op('HAS_CUTSCENE_LOADED'),[])).condition).toBe(true);
  run(game,world,instruction(op('START_CUTSCENE'),[]));
  expect(game.cutscene.running).toBe(true);
  expect(run(game,world,instruction(op('HAS_CUTSCENE_FINISHED'),[])).condition).toBe(false);
  game.cutscene.finish();
  expect(run(game,world,instruction(op('HAS_CUTSCENE_FINISHED'),[])).condition).toBe(true);
  run(game,world,instruction(op('CLEAR_CUTSCENE'),[]));
  expect(game.cutscene).toMatchObject({name:undefined,status:CUTSCENE_NONE});
  expect(calls).toEqual(['load INTRO','start','clear']);
 });

 test('a loaded cutscene still counts as loaded once it is running or finished',()=>{
  const game=new ScmGameState();
  run(game,{},instruction(op('LOAD_CUTSCENE'),['A']));
  game.cutscene.loaded();game.cutscene.start();
  expect(run(game,{},instruction(op('HAS_CUTSCENE_LOADED'),[])).condition).toBe(true);
  game.cutscene.finish();
  expect(run(game,{},instruction(op('HAS_CUTSCENE_LOADED'),[])).condition).toBe(true);
 });

 test('the skip pair keeps the label the script jumps to, and the clear ends a skip',()=>{
  const game=new ScmGameState();
  run(game,{},instruction(op('SKIP_CUTSCENE_START_INTERNAL'),[int(1234)]));
  expect(game.cutscene).toMatchObject({skipping:true,skipLabel:1234});
  run(game,{},instruction(op('SKIP_CUTSCENE_END'),[]));
  expect(game.cutscene.skipping).toBe(false);
  run(game,{},instruction(op('SKIP_CUTSCENE_START_INTERNAL'),[int(1)]),instruction(op('CLEAR_CUTSCENE'),[]));
  expect(game.cutscene).toMatchObject({skipping:false,skipLabel:undefined});
 });
});

describe('the special characters and the mission reports',()=>{
 test('the script counts its slots from one',()=>{
  const game=new ScmGameState();
  run(game,{},instruction(op('LOAD_SPECIAL_CHARACTER'),[int(1),'CJ']));
  expect(game.specialCharacters.slots[0]).toBe('CJ');
  expect(game.specialCharacters.at(1)).toBe('CJ');
  run(game,{},instruction(op('UNLOAD_SPECIAL_CHARACTER'),[int(1)]));
  expect(game.specialCharacters.count).toBe(0);
  expect(()=>game.specialCharacters.at(0)).toThrow(/range/);
  expect(()=>game.specialCharacters.at(TOTAL_SPECIAL_CHARACTERS+1)).toThrow(/range/);
 });

 test('the mission reports are kept',()=>{
  const game=new ScmGameState();
  run(game,{},instruction(op('MISSION_HAS_FINISHED'),[]),
   instruction(op('REGISTER_MISSION_PASSED'),['INTRO1']));
  expect(game.missionFinished).toBe(true);
  expect(game.missionPassedKey).toBe('INTRO1');
 });
});
