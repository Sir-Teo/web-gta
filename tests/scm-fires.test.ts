import {describe,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {MAX_FIRE_GENERATIONS,MAX_NUM_FIRES,ScmFires,scriptThingHandle} from '../src/engine/ScmFires';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';

const file=()=>new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
/** A mission thread: the script's fire commands index the shared mission locals, not a thread's own 34. */
function threadAt(bytes:Uint8Array,offset:number,game:ScmGameState){
 const host:ScmThreadHost={startScript(){throw new Error('unexpected');},game,world:{fade(){}} as ScmWorldCommands};
 return new ScmThread(bytes,offset,0,new DataView(new ArrayBuffer(1024*4)),host);
}
const runOne=(thread:ScmThread)=>{try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}};
function find(name:string){
 const bytes=file(),header=readScmHeader(bytes);
 const blocks=[decodeScmInstructions(bytes,header.entry,header.mainSize)];
 for(const m of header.missions){try{blocks.push(decodeScmInstructions(bytes,m.start,m.end));}catch{/* undecodable tail */}}
 const found=blocks.flat().find(i=>i.name===name);
 expect(found,name).toBeDefined();
 return {bytes,instruction:found!};
}

describe('script fires',()=>{
 test('a handle carries the slot below its reference counter',()=>{
  expect(scriptThingHandle(3,1)).toEqual({handle:2<<16|3,referenceIndex:2});
  expect(scriptThingHandle(0,-1)).toEqual({handle:1<<16,referenceIndex:1});
  expect(ScmFires.indexOf(2<<16|3)).toBe(3);
 });

 test('the script starts a fire, finds it burning and puts it out',()=>{
  const fires=new ScmFires();
  const handle=fires.startScriptFire({x:10,y:20,z:3},5,2);
  expect(handle).toBeGreaterThan(0);
  expect(fires.active).toBe(1);
  expect(fires.exists(handle)).toBe(true);
  expect(fires.isExtinguished(handle)).toBe(false);
  expect(fires.coords(handle)).toEqual({x:10,y:20,z:3});
  const fire=fires.fires[ScmFires.indexOf(handle)];
  expect(fire.strength).toBe(5);
  expect(fire.generationsAllowed).toBe(2);
  expect(fire.createdByScript).toBe(true);
  fires.removeScriptFire(handle);
  expect(fires.isExtinguished(handle)).toBe(true);
  expect(fires.exists(handle)).toBe(false);
  expect(fires.active).toBe(0);
 });

 test('the generation cap trims what the script asks for',()=>{
  const fires=new ScmFires();
  expect(fires.maxGenerations).toBe(MAX_FIRE_GENERATIONS);
  fires.maxGenerations=3;
  const handle=fires.startScriptFire({x:0,y:0,z:0},1,9);
  expect(fires.fires[ScmFires.indexOf(handle)].generationsAllowed).toBe(3);
 });

 test('a full pool puts out one of its own fires to make room, and every slot stays in use',()=>{
  const fires=new ScmFires();
  const handles=Array.from({length:MAX_NUM_FIRES},(_,k)=>fires.startScriptFire({x:k,y:0,z:0},1,1));
  expect(handles.every(h=>h>0)).toBe(true);
  expect(fires.active).toBe(MAX_NUM_FIRES);
  expect(fires.plentyAvailable()).toBe(false);
  // The sixty-first takes the first slot back, so the count holds and the old handle is gone.
  const extra=fires.startScriptFire({x:99,y:0,z:0},1,1);
  expect(extra).toBeGreaterThan(0);
  expect(fires.active).toBe(MAX_NUM_FIRES);
  expect(ScmFires.indexOf(extra)).toBe(0);
  expect(fires.coords(handles[0])).toEqual({x:99,y:0,z:0});
 });

 test('clearing the flags leaves the fires burning, and removing them all does not',()=>{
  const fires=new ScmFires();
  const handle=fires.startScriptFire({x:1,y:1,z:1},1,1);
  fires.clearAllScriptFireFlags();
  expect(fires.isExtinguished(handle)).toBe(false);
  expect(fires.exists(handle)).toBe(false);
  fires.removeAllScriptFires();
  expect(fires.isExtinguished(handle)).toBe(false); // it is no longer the script's, so nothing removed it
  fires.startScriptFire({x:2,y:2,z:2},1,1);
  fires.removeAllScriptFires();
  expect(fires.active).toBe(1);
 });

 test('counting and extinguishing ignore the fires the script owns',()=>{
  const fires=new ScmFires();
  fires.startScriptFire({x:0,y:0,z:0},1,1);
  expect(fires.numFiresInRange({x:0,y:0},50)).toBe(0);
  fires.clearAllScriptFireFlags();
  expect(fires.numFiresInRange({x:0,y:0},50)).toBe(1);
  expect(fires.numFiresInRange({x:100,y:0},50)).toBe(0);
  expect(fires.numFiresInArea({x:-1,y:-1,z:-1},{x:1,y:1,z:1})).toBe(1);
  expect(fires.numFiresInArea({x:10,y:10,z:10},{x:20,y:20,z:20})).toBe(0);
  fires.extinguishPoint({x:0,y:0,z:0},5);
  expect(fires.active).toBe(0);
 });

 test('the script’s own START_SCRIPT_FIRE writes its handle back',()=>{
  const {bytes,instruction}=find('START_SCRIPT_FIRE'),game=new ScmGameState();
  const thread=threadAt(bytes,instruction.offset,game);
  runOne(thread);
  expect(game.fires.active).toBe(1);
  const destination=instruction.parameters[5];
  const handle=destination.type===2
   ?new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getInt32(destination.value as number,true)
   :thread.locals.getInt32((destination.value as number)*4,true);
  expect(game.fires.exists(handle)).toBe(true);
  const size=instruction.parameters[4].value as number;
  expect(game.fires.fires[ScmFires.indexOf(handle)].strength).toBe(size);
 });
});
