import {describe,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmThread,UnsupportedScmCommand,type ScmThreadHost} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';
import {readInitialRestartPoints} from '../src/assets/scmRestartPoints';
import {LEVEL_COUNTRYSIDE} from '../src/simulation/nativeRestart';

const file=()=>new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
/** One instruction: the thread's own watchdog ends the run, since these commands never wait or terminate. */
function runOne(thread:ScmThread){
 try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
}
/** A thread over the script file itself, started at one instruction offset. */
function threadAt(bytes:Uint8Array,offset:number,game=new ScmGameState()){
 const host:ScmThreadHost={startScript(){throw new Error('unexpected');},game};
 return {thread:new ScmThread(bytes,offset,0,undefined,host),game};
}

describe('CRestart script commands',()=>{
 test('INITIAL fills the hospital and police tables exactly as the static reader does',()=>{
  const bytes=file(),header=readScmHeader(bytes),mission=header.missions[0];
  const code=decodeScmInstructions(bytes,mission.start,mission.end);
  const first=code.find(i=>i.name==='ADD_HOSPITAL_RESTART');
  expect(first).toBeDefined();
  const {thread,game}=threadAt(bytes,first!.offset);
  // The run stops at the next command the runtime has not ported, which is the stunt jump that follows the block.
  expect(()=>thread.run(0,200)).toThrow(UnsupportedScmCommand);
  expect(()=>thread.run(0,200)).toThrow('ADD_STUNT_JUMP');
  const expected=readInitialRestartPoints(bytes);
  expect(game.restart.hospitals).toEqual(expected.hospitals);
  expect(game.restart.police).toEqual(expected.police);
 });

 test('MAIN sets the extra hospital and police points, and clears them with a zero radius',()=>{
  const bytes=file(),header=readScmHeader(bytes);
  const code=decodeScmInstructions(bytes,header.entry,header.mainSize);
  const extras=code.filter(i=>i.name==='SET_EXTRA_POLICE_STATION_RESTART_POINT'||i.name==='SET_EXTRA_HOSPITAL_RESTART_POINT');
  expect(extras.length).toBeGreaterThanOrEqual(2);
  const {thread,game}=threadAt(bytes,extras[0].offset);
  runOne(thread);
  expect(game.restart.extraPolice.radius).toBe(1500);
  expect(game.restart.extraPolice.position[0]).toBeCloseTo(-1379.8427,3);
  expect(game.restart.extraPolice.heading).toBeCloseTo(170.6194,3);
  // The same point again with a radius of zero is how the script turns it off.
  const off=extras.find(i=>i.name==='SET_EXTRA_POLICE_STATION_RESTART_POINT'&&i.parameters[3]?.value===0);
  expect(off).toBeDefined();
  const second=threadAt(bytes,off!.offset);runOne(second.thread);
  expect(second.game.restart.extraPolice.radius).toBe(0);
 });

 test('a restart point added by script is the one the death lookup returns',()=>{
  const bytes=file(),header=readScmHeader(bytes),mission=header.missions[0];
  const code=decodeScmInstructions(bytes,mission.start,mission.end);
  const first=code.find(i=>i.name==='ADD_HOSPITAL_RESTART')!;
  const {thread,game}=threadAt(bytes,first.offset);
  expect(()=>thread.run(0,200)).toThrow(UnsupportedScmCommand);
  const fallback={position:[0,0,0] as [number,number,number],heading:0};
  const closest=game.restart.findClosestHospitalRestartPoint([2030,-1420,16],0,()=>LEVEL_COUNTRYSIDE,fallback);
  expect(closest.position[0]).toBeCloseTo(2027.77,2);
  expect(closest.heading).toBeCloseTo(137,3);
  // A point behind a locked city is skipped until STAT_CITY_UNLOCKED reaches its town id.
  const locked=game.restart.findClosestHospitalRestartPoint([1578,1770,10],0,()=>LEVEL_COUNTRYSIDE,fallback);
  expect(locked.position[0]).not.toBeCloseTo(1578.446,2);
  const unlocked=game.restart.findClosestHospitalRestartPoint([1578,1770,10],2,()=>LEVEL_COUNTRYSIDE,fallback);
  expect(unlocked.position[0]).toBeCloseTo(1578.446,2);
 });

 test('OVERRIDE_NEXT_RESTART is consumed by one lookup and CANCEL_OVERRIDE_RESTART drops it',()=>{
  const bytes=file(),header=readScmHeader(bytes);
  const blocks=header.missions.map(m=>{try{return decodeScmInstructions(bytes,m.start,m.end);}catch{return [];}});
  const override=blocks.flat().find(i=>i.name==='OVERRIDE_NEXT_RESTART')!;
  expect(override).toBeDefined();
  const {thread,game}=threadAt(bytes,override.offset);
  runOne(thread);
  expect(game.restart.overrideActive).toBe(true);
  const fallback={position:[0,0,0] as [number,number,number],heading:0};
  const first=game.restart.findClosestPoliceRestartPoint([0,0,0],2,()=>LEVEL_COUNTRYSIDE,fallback);
  expect(first.position[0]).toBeCloseTo(override.parameters[0].value as number,3);
  expect(game.restart.overrideActive).toBe(false);
  // The script's own CANCEL_OVERRIDE_RESTART drops an override that no death consumed.
  const cancel=blocks.flat().find(i=>i.name==='CANCEL_OVERRIDE_RESTART')!;
  runOne(threadAt(bytes,override.offset,game).thread);
  expect(game.restart.overrideActive).toBe(true);
  runOne(threadAt(bytes,cancel.offset,game).thread);
  expect(game.restart.overrideActive).toBe(false);
  // Nothing was added to the tables, so the next lookup falls through.
  expect(game.restart.findClosestPoliceRestartPoint([0,0,0],2,()=>LEVEL_COUNTRYSIDE,fallback)).toEqual(fallback);
 });

 test('SET_RESPAWN_POINT_FOR_DURATION_OF_MISSION moves the query point for one lookup',()=>{
  const bytes=file(),header=readScmHeader(bytes);
  const code=decodeScmInstructions(bytes,header.missions[0].start,header.missions[0].end);
  const first=code.find(i=>i.name==='ADD_HOSPITAL_RESTART')!;
  const {thread,game}=threadAt(bytes,first.offset);
  expect(()=>thread.run(0,200)).toThrow(UnsupportedScmCommand);
  game.restart.setRespawnPointForDurationOfMission([1578,1770,10]);
  const fallback={position:[0,0,0] as [number,number,number],heading:0};
  const moved=game.restart.findClosestHospitalRestartPoint([2030,-1420,16],2,()=>LEVEL_COUNTRYSIDE,fallback);
  expect(moved.position[0]).toBeCloseTo(1578.446,2);
  expect(game.restart.missionBaseActive).toBe(false);
 });
});
