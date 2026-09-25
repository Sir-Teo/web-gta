import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {AUDIO_LOADED,AUDIO_LOADING,AUDIO_NOT_LOADED,MISSION_AUDIO_COUNT} from '../src/engine/ScmMissionAudio';
import {scmOpcode} from '../src/engine/scmOpcodes';

function instruction(opcode:number,values:number[],floats=false){
 const out:number[]=[opcode&0xff,opcode>>8&0xff];
 for(const value of values){
  const bytes=new Uint8Array(4),view=new DataView(bytes.buffer);
  if(floats){view.setFloat32(0,value,true);out.push(6,...bytes);}
  else {view.setInt32(0,value,true);out.push(1,...bytes);}
 }
 return out;
}
function run(game:ScmGameState,world:Partial<ScmWorldCommands>,...instructions:number[][]){
 const space=new Uint8Array(1024);space.set(instructions.flat(),0);
 const host:ScmThreadHost={startScript(){},game,world:{fade(){},...world} as ScmWorldCommands};
 const thread=new ScmThread(space,0,0,undefined,host);
 try{thread.run(0,32);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return thread;
}
const op=scmOpcode;

describe('the mission audio a script loads and plays',()=>{
 test('a slot the script numbers one is the engine’s first, and an empty slot reads as minus one',()=>{
  const game=new ScmGameState();
  expect(game.missionAudio.slots[0]).toMatchObject({audioEvent:-1,bankId:-1,bankSlotId:-1,loadingStatus:AUDIO_NOT_LOADED});
  const asked:number[][]=[];
  run(game,{loadMissionAudio:(slot,sample)=>{asked.push([slot,sample]);}},instruction(op('LOAD_MISSION_AUDIO'),[1,3045]));
  expect(game.missionAudio.slots[0]).toMatchObject({audioEvent:3045,loadingStatus:AUDIO_LOADING});
  expect(game.missionAudio.slots[1].audioEvent).toBe(-1);
  expect(asked).toEqual([[1,3045]]);
 });

 test('the script waits for the slot, plays it, waits again and clears it',()=>{
  const game=new ScmGameState();const played:number[]=[],cleared:number[]=[];
  const world={playMissionAudio:(slot:number)=>{played.push(slot);},clearMissionAudio:(slot:number)=>{cleared.push(slot);}};
  run(game,world,instruction(op('LOAD_MISSION_AUDIO'),[2,101]));
  expect(run(game,world,instruction(op('HAS_MISSION_AUDIO_LOADED'),[2])).condition).toBe(false);
  // Playing a slot that is not ready does nothing, which an unloaded sample has nothing to do.
  run(game,world,instruction(op('PLAY_MISSION_AUDIO'),[2]));
  expect(played).toEqual([]);
  game.missionAudio.loaded(2,7,3);
  expect(run(game,world,instruction(op('HAS_MISSION_AUDIO_LOADED'),[2])).condition).toBe(true);
  expect(game.missionAudio.slots[1]).toMatchObject({loadingStatus:AUDIO_LOADED,bankId:7,bankSlotId:3});
  run(game,world,instruction(op('PLAY_MISSION_AUDIO'),[2]));
  expect(played).toEqual([2]);
  expect(run(game,world,instruction(op('IS_MISSION_AUDIO_PLAYING'),[])).condition).toBe(true);
  expect(run(game,world,instruction(op('HAS_MISSION_AUDIO_FINISHED'),[2])).condition).toBe(false);
  game.missionAudio.finish(2);
  expect(run(game,world,instruction(op('HAS_MISSION_AUDIO_FINISHED'),[2])).condition).toBe(true);
  expect(run(game,world,instruction(op('IS_MISSION_AUDIO_PLAYING'),[])).condition).toBe(false);
  run(game,world,instruction(op('CLEAR_MISSION_AUDIO'),[2]));
  expect(cleared).toEqual([2]);
  expect(game.missionAudio.slots[1]).toMatchObject({audioEvent:-1,bankId:-1,loadingStatus:AUDIO_NOT_LOADED,playing:false});
 });

 test('the loading question asks about all four slots at once, having no slot operand of its own',()=>{
  const game=new ScmGameState();
  expect(run(game,{},instruction(op('IS_MISSION_AUDIO_LOADING'),[])).condition).toBe(false);
  run(game,{},instruction(op('LOAD_MISSION_AUDIO'),[4,9]));
  expect(run(game,{},instruction(op('IS_MISSION_AUDIO_LOADING'),[])).condition).toBe(true);
  game.missionAudio.loaded(4);
  expect(run(game,{},instruction(op('IS_MISSION_AUDIO_LOADING'),[])).condition).toBe(false);
  expect(game.missionAudio.loadedCount).toBe(1);
 });

 test('a slot outside the four is refused, and so is slot zero',()=>{
  const game=new ScmGameState();
  expect(()=>game.missionAudio.preload(0,1)).toThrow(/range/);
  expect(()=>game.missionAudio.preload(MISSION_AUDIO_COUNT+1,1)).toThrow(/range/);
  game.missionAudio.preload(MISSION_AUDIO_COUNT,1);
  expect(game.missionAudio.slots[MISSION_AUDIO_COUNT-1].audioEvent).toBe(1);
 });

 test('a slot follows a point or an entity, and each replaces the other',()=>{
  const game=new ScmGameState();
  // The slot is an integer and the point is three floats.
  const slotBytes=new Uint8Array(4);new DataView(slotBytes.buffer).setInt32(0,1,true);
  run(game,{},[...instruction(op('SET_MISSION_AUDIO_POSITION'),[]),1,...slotBytes,
   ...instruction(0,[10,20,30],true).slice(2)]);
  expect(game.missionAudio.slots[0]).toMatchObject({position:{x:10,y:20,z:30},entity:undefined});
  run(game,{},instruction(op('ATTACH_MISSION_AUDIO_TO_CHAR'),[1,44]));
  expect(game.missionAudio.slots[0]).toMatchObject({entity:{kind:'ped',handle:44},position:undefined});
  run(game,{},instruction(op('ATTACH_MISSION_AUDIO_TO_CAR'),[1,55]));
  expect(game.missionAudio.slots[0].entity).toEqual({kind:'vehicle',handle:55});
  run(game,{},instruction(op('ATTACH_MISSION_AUDIO_TO_OBJECT'),[1,66]));
  expect(game.missionAudio.slots[0].entity).toEqual({kind:'object',handle:66});
 });

 test('the report commands name no slot and record the event where the script asked',()=>{
  const game=new ScmGameState();
  run(game,{},instruction(op('REPORT_MISSION_AUDIO_EVENT_AT_CHAR'),[7,1234]),
   instruction(op('REPORT_MISSION_AUDIO_EVENT_AT_CAR'),[8,1235]),
   instruction(op('REPORT_MISSION_AUDIO_EVENT_AT_OBJECT'),[9,1236]));
  expect(game.missionAudio.reported).toEqual([
   {audioEvent:1234,at:{kind:'ped',handle:7}},
   {audioEvent:1235,at:{kind:'vehicle',handle:8}},
   {audioEvent:1236,at:{kind:'object',handle:9}},
  ]);
  // The position form takes its point first and the event last.
  const game2=new ScmGameState();
  const bytes=[...instruction(op('REPORT_MISSION_AUDIO_EVENT_AT_POSITION'),[1,2,3],true)];
  const event=new Uint8Array(4);new DataView(event.buffer).setInt32(0,99,true);
  bytes.push(1,...event);
  run(game2,{},bytes);
  expect(game2.missionAudio.reported).toEqual([{audioEvent:99,at:{x:1,y:2,z:3}}]);
  expect(game2.missionAudio.slots.every(slot=>slot.audioEvent===-1)).toBe(true);
 });
});

test('ADD_ONE_OFF_SOUND reports its script event at its point, and only the latest reports are kept',async()=>{
 const {ScmMissionAudio,REPORTS_KEPT}=await import('../src/engine/ScmMissionAudio');
 const audio=new ScmMissionAudio();
 for(let i=0;i<REPORTS_KEPT+10;i++)audio.report(1000+i,{x:i,y:0,z:0});
 expect(audio.reported).toHaveLength(REPORTS_KEPT);expect(audio.reported[0].audioEvent).toBe(1010);
});
