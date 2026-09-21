import {describe,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {WANTED_CHAOS} from '../src/simulation/nativeWanted';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';

const file=()=>new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
function threadAt(bytes:Uint8Array,offset:number,game:ScmGameState){
 const host:ScmThreadHost={startScript(){throw new Error('unexpected');},game,world:{fade(){}} as ScmWorldCommands};
 return new ScmThread(bytes,offset,0,new DataView(new ArrayBuffer(1024*4)),host);
}
const runOne=(thread:ScmThread)=>{try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}};
function find(name:string,literalAt?:number){
 const bytes=file(),header=readScmHeader(bytes);
 const blocks=[decodeScmInstructions(bytes,header.entry,header.mainSize)];
 for(const mission of header.missions)blocks.push(decodeScmInstructions(bytes,mission.start,mission.end));
 const found=blocks.flat().find(i=>i.name===name&&(literalAt===undefined||[1,4,5,6].includes(i.parameters[literalAt].type)));
 expect(found,name).toBeDefined();
 return {bytes,instruction:found!};
}

describe('wanted level commands',()=>{
 test('the script raises the wanted level and the chaos that goes with it',()=>{
  const {bytes,instruction}=find('ALTER_WANTED_LEVEL',1),game=new ScmGameState();
  runOne(threadAt(bytes,instruction.offset,game));
  const level=instruction.parameters[1].value as number;
  expect(game.wanted.level).toBe(level);
  expect(game.wanted.chaos).toBe(WANTED_CHAOS[level]);
 });

 test('the maximum the script set trims what a later command can ask for',()=>{
  const game=new ScmGameState();
  game.setMaximumWantedLevel(2);
  expect(game.wanted.maximumChaos).toBe(game.maximumChaosLevel);
  game.wanted.setWantedLevel(Math.min(5,game.maximumWantedLevel));
  expect(game.wanted.level).toBe(2);
  expect(game.wanted.chaos).toBe(WANTED_CHAOS[2]);
 });

 test('the no-drop form only ever raises the level',()=>{
  const game=new ScmGameState();
  game.wanted.setWantedLevel(4);
  game.wanted.setWantedLevelNoDrop(2);
  expect(game.wanted.level).toBe(4);
  game.wanted.setWantedLevelNoDrop(5);
  expect(game.wanted.level).toBe(5);
 });

 test('CLEAR_WANTED_LEVEL puts the player back to clean',()=>{
  const {bytes,instruction}=find('CLEAR_WANTED_LEVEL'),game=new ScmGameState();
  game.wanted.setWantedLevel(3);
  expect(game.wanted.level).toBe(3);
  runOne(threadAt(bytes,instruction.offset,game));
  expect(game.wanted.level).toBe(0);
  expect(game.wanted.chaos).toBe(0);
 });

 test('IS_WANTED_LEVEL_GREATER compares against the level the script names',()=>{
  const {bytes,instruction}=find('IS_WANTED_LEVEL_GREATER',1),game=new ScmGameState();
  const level=instruction.parameters[1].value as number;
  // The script may use the negated form of the test, which flips what the thread's condition ends up as.
  const negated=(instruction.opcode&0x8000)!==0;
  game.wanted.setWantedLevel(level);
  const same=threadAt(bytes,instruction.offset,game);runOne(same);
  expect(same.condition).toBe(negated);
  game.wanted.setWantedLevel(Math.min(6,level+1));
  const higher=threadAt(bytes,instruction.offset,game);runOne(higher);
  expect(higher.condition).toBe(level<6?!negated:negated);
 });
});
