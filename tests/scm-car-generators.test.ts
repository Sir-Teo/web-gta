import {describe,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmThread,UnsupportedScmCommand,type ScmThreadHost} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {GENERATE_ALWAYS,NUM_CAR_GENERATORS,ScmCarGenerators} from '../src/engine/ScmCarGenerators';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';

const file=()=>new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
function threadAt(bytes:Uint8Array,offset:number,game=new ScmGameState()){
 const host:ScmThreadHost={startScript(){throw new Error('unexpected');},game};
 return {thread:new ScmThread(bytes,offset,0,undefined,host),game};
}
const runOne=(thread:ScmThread)=>{try{thread.run(1000,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}};

describe('CTheCarGenerators script commands',()=>{
 test('a created generator takes the first free slot and starts switched off',()=>{
  const generators=new ScmCarGenerators();
  const index=generators.create({position:[10,20,30],angle:90,modelId:432,primaryColour:-1,secondaryColour:-1,forceSpawn:true,alarmChance:0,doorLockChance:0,minDelay:0,maxDelay:10000},500);
  expect(index).toBe(0);
  const record=generators.at(0);
  expect(record.used).toBe(true);
  expect(record.generateCount).toBe(0);
  expect(record.vehicleHandle).toBe(-1);
  expect(record.nextGenTime).toBe(501);
  // Setup packs the heading into a signed byte: ninety degrees is sixty-four.
  expect(record.angle).toBe(64);
  expect(record.highPriority).toBe(true);
  expect(record.waitUntilFarFromPlayer).toBe(false);
 });

 test('a model outside the vehicle range is refused, and -1 stands for any car',()=>{
  const generators=new ScmCarGenerators();
  expect(generators.create({position:[0,0,0],angle:0,modelId:399,primaryColour:0,secondaryColour:0,forceSpawn:false,alarmChance:0,doorLockChance:0,minDelay:0,maxDelay:0},0)).toBe(-1);
  expect(generators.create({position:[0,0,0],angle:0,modelId:631,primaryColour:0,secondaryColour:0,forceSpawn:false,alarmChance:0,doorLockChance:0,minDelay:0,maxDelay:0},0)).toBe(-1);
  expect(generators.create({position:[0,0,0],angle:0,modelId:-1,primaryColour:0,secondaryColour:0,forceSpawn:false,alarmChance:0,doorLockChance:0,minDelay:0,maxDelay:0},0)).toBe(0);
  expect(generators.count).toBe(1);
 });

 test('the array holds five hundred generators and refuses the next one',()=>{
  const generators=new ScmCarGenerators();
  for(let i=0;i<NUM_CAR_GENERATORS;i++)expect(generators.create({position:[i,0,0],angle:0,modelId:400,primaryColour:0,secondaryColour:0,forceSpawn:false,alarmChance:0,doorLockChance:0,minDelay:0,maxDelay:0},0)).toBe(i);
  expect(generators.create({position:[0,0,0],angle:0,modelId:400,primaryColour:0,secondaryColour:0,forceSpawn:false,alarmChance:0,doorLockChance:0,minDelay:0,maxDelay:0},0)).toBe(-1);
 });

 test('MAIN creates its parked cars and hands the script each slot number',()=>{
  const bytes=file(),header=readScmHeader(bytes);
  const code=decodeScmInstructions(bytes,header.entry,header.mainSize);
  const first=code.findIndex(i=>i.name==='CREATE_CAR_GENERATOR');
  expect(first).toBeGreaterThan(0);
  const {thread,game}=threadAt(bytes,code[first].offset);
  // The run stops at the first command of this stretch the runtime has not ported.
  expect(()=>thread.run(1000,600)).toThrow(UnsupportedScmCommand);
  const made=game.carGenerators.count;
  expect(made).toBeGreaterThan(0);
  const script=code.slice(first).filter(i=>i.name==='CREATE_CAR_GENERATOR').slice(0,made);
  const globals=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  for(const [slot,command] of script.entries()){
   const record=game.carGenerators.at(slot);
   expect(record.modelId).toBe(command.parameters[4].value);
   expect(record.position[0]).toBeCloseTo(command.parameters[0].value as number,3);
   // The handle each command wrote back is its own slot number, counting up from zero.
   expect(globals.getInt32(command.parameters[12].value as number,true)).toBe(slot);
  }
 });

 test('the script switches a generator on with a count of 101 and off with none',()=>{
  const bytes=file(),header=readScmHeader(bytes);
  const code=decodeScmInstructions(bytes,header.entry,header.mainSize);
  const on=code.find(i=>i.name==='SWITCH_CAR_GENERATOR'&&i.parameters[1]?.value===101);
  const off=code.find(i=>i.name==='SWITCH_CAR_GENERATOR'&&i.parameters[1]?.value===0);
  expect(on&&off).toBeTruthy();
  const game=new ScmGameState();
  game.carGenerators.create({position:[0,0,0],angle:0,modelId:400,primaryColour:0,secondaryColour:0,forceSpawn:false,alarmChance:0,doorLockChance:0,minDelay:0,maxDelay:0},0);
  // Both commands address the generator by the handle the script stored; slot zero stands in here.
  const globals=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const handle=on!.parameters[0].value as number;
  const saved=globals.getInt32(handle,true);globals.setInt32(handle,0,true);
  runOne(threadAt(bytes,on!.offset,game).thread);
  expect(game.carGenerators.at(0).generateCount).toBe(GENERATE_ALWAYS);
  expect(game.carGenerators.at(0).nextGenTime).toBe(1004);
  globals.setInt32(handle,saved,true);
  const offHandle=off!.parameters[0].value as number,savedOff=globals.getInt32(offHandle,true);
  globals.setInt32(offHandle,0,true);
  runOne(threadAt(bytes,off!.offset,game).thread);
  expect(game.carGenerators.at(0).generateCount).toBe(0);
  globals.setInt32(offHandle,savedOff,true);
 });
});

describe('plated generators',()=>{
 test('a plate is registered for the generator it belongs to, fifteen at most',()=>{
  const generators=new ScmCarGenerators();
  const index=generators.create({position:[0,0,0],angle:0,modelId:400,primaryColour:0,secondaryColour:0,forceSpawn:false,alarmChance:0,doorLockChance:0,minDelay:0,maxDelay:0},0);
  expect(generators.addPlate(index,'HOMEGIRL')).toBe(true);
  expect(generators.plateFor(index)).toBe('HOMEGIRL');
  expect(generators.plateFor(index+1)).toBeUndefined();
  for(let i=1;i<15;i++)expect(generators.addPlate(i,`P${i}`)).toBe(true);
  expect(generators.addPlate(99,'TOOMANY')).toBe(false);
 });
});
