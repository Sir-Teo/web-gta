import {describe,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState,STAT_MISSION_ATTEMPTS,STAT_PROGRESS_MADE} from '../src/engine/ScmGameState';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';

const file=()=>new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
function threadAt(bytes:Uint8Array,offset:number,game:ScmGameState,world?:Partial<ScmWorldCommands>){
 const adapter={fade(){},...world} as ScmWorldCommands;
 const host:ScmThreadHost={startScript(){throw new Error('unexpected');},game,world:adapter};
 return new ScmThread(bytes,offset,0,undefined,host);
}
const runOne=(thread:ScmThread)=>{try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}};
function find(name:string){
 const bytes=file(),header=readScmHeader(bytes);
 const blocks=[decodeScmInstructions(bytes,header.entry,header.mainSize)];
 for(const m of header.missions){try{blocks.push(decodeScmInstructions(bytes,m.start,m.end));}catch{/* undecodable tail */}}
 const found=blocks.flat().find(i=>i.name===name);
 expect(found,`${name} with literal operands`).toBeDefined();
 return {bytes,instruction:found!};
}

describe('small engine statics the script sets',()=>{
 test('CStats::IncrementStat adds, caps a capped stat and ignores a value at or below zero',()=>{
  const game=new ScmGameState();
  game.stats.increment(STAT_PROGRESS_MADE,5);
  expect(game.stats.get(STAT_PROGRESS_MADE)).toBe(5);
  game.stats.increment(STAT_PROGRESS_MADE,0);
  game.stats.increment(STAT_PROGRESS_MADE,-3);
  expect(game.stats.get(STAT_PROGRESS_MADE)).toBe(5);
  // Stamina is capped, so it stops at a thousand however much the script adds.
  game.stats.increment(22,5000);
  expect(game.stats.get(22)).toBe(1000);
  // An integer stat truncates what it is given.
  game.stats.increment(STAT_MISSION_ATTEMPTS,2.9);
  expect(game.stats.get(STAT_MISSION_ATTEMPTS)).toBe(2);
 });

 test('the calorie and health increments are left to the host',()=>{
  const game=new ScmGameState();
  expect(()=>game.stats.increment(245,10)).toThrow('read the player');
  expect(()=>game.stats.increment(335,10)).toThrow('read the player');
 });

 test('PLAYER_MADE_PROGRESS and REGISTER_MISSION_GIVEN move their own stats',()=>{
  const progress=find('PLAYER_MADE_PROGRESS'),game=new ScmGameState();
  runOne(threadAt(progress.bytes,progress.instruction.offset,game));
  expect(game.stats.get(STAT_PROGRESS_MADE)).toBe(progress.instruction.parameters[0].value);
  const given=find('REGISTER_MISSION_GIVEN');
  runOne(threadAt(given.bytes,given.instruction.offset,game));
  expect(game.stats.get(STAT_MISSION_ATTEMPTS)).toBe(1);
 });

 /** One command with no operands, assembled: three of these never appear in MAIN.SCM itself. */
 const bare=(opcode:number)=>{const bytes=new Uint8Array(2);new DataView(bytes.buffer).setUint16(0,opcode,true);return bytes;};

 test('the script sets the ped density, the radar and the military zones',()=>{
  const density=find('SET_PED_DENSITY_MULTIPLIER'),game=new ScmGameState();
  runOne(threadAt(density.bytes,density.instruction.offset,game));
  expect(game.pedDensityMultiplier).toBeCloseTo(density.instruction.parameters[0].value as number,4);
  const radar=find('DISPLAY_RADAR');
  runOne(threadAt(radar.bytes,radar.instruction.offset,game));
  expect(game.displayRadar).toBe(radar.instruction.parameters[0].value!==0);
  const military=find('SET_DISABLE_MILITARY_ZONES');
  runOne(threadAt(military.bytes,military.instruction.offset,game));
  expect(game.militaryZonesDisabled).toBe(military.instruction.parameters[0].value!==0);
 });

 test('TAKE_PHOTO raises both photo flags',()=>{
  // The photo, fail and widescreen commands belong to the streamed mission scripts, so they are assembled here.
  const bytes=new Uint8Array(4);const view=new DataView(bytes.buffer);
  view.setUint16(0,0xa1e,true);bytes[2]=4;bytes[3]=1;
  const game=new ScmGameState();
  runOne(threadAt(bytes,0,game));
  expect(game.takePhoto).toBe(true);
  expect(game.savePhotoFromScript).toBe(true);
 });

 test('FAIL_CURRENT_MISSION sets the two-frame countdown the scheduler reads',()=>{
  const game=new ScmGameState();
  runOne(threadAt(bare(0x45c),0,game));
  expect(game.failCurrentMission).toBe(2);
 });

 test('GET_GROUND_Z_FOR_3D_COORD writes what the world answers into the script\u2019s own local',()=>{
  const {bytes,instruction}=find('GET_GROUND_Z_FOR_3D_COORD'),game=new ScmGameState();
  // The script passes this one four locals, so the thread's own storage carries the point and the answer.
  expect(instruction.parameters.map(p=>p.type)).toEqual([3,3,3,3]);
  const thread=threadAt(bytes,instruction.offset,game,{groundZFor3DCoord:()=>12.5});
  runOne(thread);
  expect(thread.locals.getFloat32((instruction.parameters[3].value as number)*4,true)).toBeCloseTo(12.5,4);
 });

 test('the widescreen question answers from the option the host set, and the Japanese one is a flat no',()=>{
  const game=new ScmGameState();
  const first=threadAt(bare(0xa2b),0,game);runOne(first);
  expect(first.condition).toBe(false);
  game.widescreen=true;
  const second=threadAt(bare(0xa2b),0,game);runOne(second);
  expect(second.condition).toBe(true);
  const japanese=threadAt(bare(0xa4d),0,game);runOne(japanese);
  expect(japanese.condition).toBe(false);
 });
});
