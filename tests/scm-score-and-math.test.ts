import {describe,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';

const file=()=>new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
function threadAt(bytes:Uint8Array,offset:number,game:ScmGameState){
 const host:ScmThreadHost={startScript(){throw new Error('unexpected');},game,world:{fade(){}} as ScmWorldCommands};
 return new ScmThread(bytes,offset,0,new DataView(new ArrayBuffer(1024*4)),host);
}
const runOne=(thread:ScmThread)=>{try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}};
function find(name:string){
 const bytes=file(),header=readScmHeader(bytes);
 const blocks=[decodeScmInstructions(bytes,header.entry,header.mainSize)];
 for(const mission of header.missions)blocks.push(decodeScmInstructions(bytes,mission.start,mission.end));
 const found=blocks.flat().find(i=>i.name===name);
 expect(found,name).toBeDefined();
 return {bytes,instruction:found!};
}
/** Assemble one command whose operands are all float immediates, plus a local to write into. */
function floats(opcode:number,values:number[],destination:number){
 const bytes=new Uint8Array(2+values.length*5+3);
 const view=new DataView(bytes.buffer);
 view.setUint16(0,opcode,true);
 values.forEach((value,k)=>{bytes[2+k*5]=6;view.setFloat32(3+k*5,value,true);});
 bytes[2+values.length*5]=3;view.setUint16(3+values.length*5,destination,true);
 return bytes;
}

describe('score, stats and the script’s arithmetic',()=>{
 test('the score adds up, compares and reads back',()=>{
  const {bytes,instruction}=find('ADD_SCORE'),game=new ScmGameState();
  runOne(threadAt(bytes,instruction.offset,game));
  expect(game.money).toBe(instruction.parameters[1].value);
  const greater=find('IS_SCORE_GREATER');
  game.money=1_000_000;
  const thread=threadAt(greater.bytes,greater.instruction.offset,game);runOne(thread);
  expect(thread.condition).toBe((greater.instruction.opcode&0x8000)===0);
  const store=find('STORE_SCORE');
  const reader=threadAt(store.bytes,store.instruction.offset,game);runOne(reader);
  const destination=store.instruction.parameters[1];
  const value=destination.type===2
   ?new DataView(store.bytes.buffer,store.bytes.byteOffset,store.bytes.byteLength).getInt32(destination.value as number,true)
   :reader.locals.getInt32((destination.value as number)*4,true);
  expect(value).toBe(1_000_000);
 });
 test('a bound purse is the one the score commands move',()=>{
  const {bytes,instruction}=find('ADD_SCORE'),game=new ScmGameState();
  game.money=25;let purse=100;game.bindMoney({get:()=>purse,set:v=>{purse=v;}});
  // What the script held before the bind carries over.
  expect(purse).toBe(125);
  runOne(threadAt(bytes,instruction.offset,game));
  expect(purse).toBe(125+(instruction.parameters[1].value as number));expect(game.money).toBe(purse);
 });

 test('a stat decrement stops at nothing and ignores a value at or below zero',()=>{
  const game=new ScmGameState();
  game.stats.set(0,10);
  game.stats.decrement(0,4);
  expect(game.stats.get(0)).toBe(6);
  game.stats.decrement(0,0);
  game.stats.decrement(0,-5);
  expect(game.stats.get(0)).toBe(6);
  game.stats.decrement(0,100);
  expect(game.stats.get(0)).toBe(0);
 });

 test('the script increments and decrements its own stats',()=>{
  const {bytes,instruction}=find('INCREMENT_INT_STAT'),game=new ScmGameState();
  const stat=instruction.parameters[0].value as number,by=instruction.parameters[1].value as number;
  const before=game.stats.get(stat);
  runOne(threadAt(bytes,instruction.offset,game));
  expect(game.stats.get(stat)).toBe(before+Math.trunc(by));
 });

 test('sine and cosine take degrees',()=>{
  const game=new ScmGameState();
  const sine=threadAt(floats(0x2f6,[90],7),0,game);runOne(sine);
  expect(sine.locals.getFloat32(7*4,true)).toBeCloseTo(1,6);
  const cosine=threadAt(floats(0x2f7,[180],8),0,game);runOne(cosine);
  expect(cosine.locals.getFloat32(8*4,true)).toBeCloseTo(-1,6);
 });

 test('the two distance commands measure flat and full',()=>{
  const game=new ScmGameState();
  const flat=threadAt(floats(0x509,[0,0,3,4],9),0,game);runOne(flat);
  expect(flat.locals.getFloat32(9*4,true)).toBeCloseTo(5,5);
  const full=threadAt(floats(0x50a,[0,0,0,1,2,2],10),0,game);runOne(full);
  expect(full.locals.getFloat32(10*4,true)).toBeCloseTo(3,5);
 });
});
