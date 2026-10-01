import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {STAT_MISSIONS_PASSED,ScmGameState} from '../src/engine/ScmGameState';
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
 test('APPEND_TO_NEXT_CUTSCENE adds an object to the next cutscene loaded, lower-cased, and only to it',()=>{
  const game=new ScmGameState();
  run(game,{},instruction(op('APPEND_TO_NEXT_CUTSCENE'),['GFPIZ1','GFPIZ1']),instruction(op('APPEND_TO_NEXT_CUTSCENE'),['GANGRL3','GFRIEND']));
  expect(game.cutscene.objects).toEqual([]);
  run(game,{},instruction(op('LOAD_CUTSCENE'),['D8_ALT']));
  expect(game.cutscene.objects).toEqual([{object:'gfpiz1',anim:'gfpiz1'},{object:'gangrl3',anim:'gfriend'}]);
  expect(game.cutscene.appended).toEqual([]);
  run(game,{},instruction(op('CLEAR_CUTSCENE'),[]));
  run(game,{},instruction(op('LOAD_CUTSCENE'),['D8_ALT']));
  expect(game.cutscene.objects).toEqual([]);
 });
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

 test('the skip pair sets and clears the thread’s scene-skip label, and naming it skips nothing',()=>{
  const game=new ScmGameState();
  expect(run(game,{},instruction(op('SKIP_CUTSCENE_START_INTERNAL'),[int(1234)])).sceneSkipIp).toBe(1234);
  expect(game.cutscene.wasSkipped).toBe(false);
  expect(run(game,{},instruction(op('SKIP_CUTSCENE_START_INTERNAL'),[int(1)]),instruction(op('SKIP_CUTSCENE_END'),[])).sceneSkipIp).toBeUndefined();
 });

 test('with the label set, the skip button sends the thread there at once, out of its wait',()=>{
  const game=new ScmGameState();let pressed=false;
  // SKIP_CUTSCENE_START_INTERNAL 64; WAIT 10000 (at 12); … and at 64 a SET_VAR_INT 40 7.
  const space=new Uint8Array(2048);
  space.set([...instruction(op('SKIP_CUTSCENE_START_INTERNAL'),[int(64)]),...instruction(op('WAIT'),[int(10000)])],0);
  space.set(instruction(op('SET_VAR_INT'),[[2,40] as const,int(7)]),64);
  const thread=new ScmThread(space,0,0,undefined,{startScript(){},game,world:{fade(){},isCutsceneSkipButtonBeingPressed:()=>pressed} as ScmWorldCommands});
  thread.run(0,16);
  expect(new DataView(space.buffer).getInt32(40,true)).toBe(0);
  pressed=true;
  try{thread.run(50,4);}catch(error){if(!String(error).match(/watchdog|opcode|Unknown/))throw error;}
  expect(new DataView(space.buffer).getInt32(40,true)).toBe(7);
  expect(thread.sceneSkipIp).toBeUndefined();
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
  // Passing counts in STAT_MISSIONS_PASSED and keeps the time; an odd job passes the same way, with no name.
  expect(game.stats.get(STAT_MISSIONS_PASSED)).toBe(1);
  expect(game.lastMissionPassedTime).toBe(0);
  run(game,{},instruction(op('REGISTER_ODDJOB_MISSION_PASSED'),[]));
  expect(game.stats.get(STAT_MISSIONS_PASSED)).toBe(2);
  expect(game.missionPassedKey).toBe('INTRO1');
 });
});
