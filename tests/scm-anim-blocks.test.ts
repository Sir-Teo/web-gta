import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {scmOpcode} from '../src/engine/scmOpcodes';

function run(bytes:Uint8Array,game:ScmGameState){
 const host:ScmThreadHost={startScript(){},game,world:{fade(){}} as ScmWorldCommands};
 const thread=new ScmThread(bytes,0,0,new DataView(new ArrayBuffer(1024*4)),host);
 try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return thread;
}
/** opcode then one short string operand. */
function withName(opcode:number,name:string){
 const bytes=new Uint8Array(2+2+name.length);
 const view=new DataView(bytes.buffer);view.setUint16(0,opcode,true);
 bytes[2]=14;bytes[3]=name.length;
 for(let i=0;i<name.length;i++)bytes[4+i]=name.charCodeAt(i);
 return bytes;
}

describe('the animation blocks a script holds',()=>{
 test('a requested block is not loaded until a host says so',()=>{
  const game=new ScmGameState();
  run(withName(scmOpcode('REQUEST_ANIMATION'),'RIOT'),game);
  expect(run(withName(scmOpcode('HAS_ANIMATION_LOADED'),'RIOT'),game).condition).toBe(false);
  game.animBlocks.load('RIOT');
  expect(run(withName(scmOpcode('HAS_ANIMATION_LOADED'),'RIOT'),game).condition).toBe(true);
 });

 test('blocks are matched without regard to case',()=>{
  const game=new ScmGameState();
  run(withName(scmOpcode('REQUEST_ANIMATION'),'Riot'),game);
  game.animBlocks.load('riot');
  expect(run(withName(scmOpcode('HAS_ANIMATION_LOADED'),'RIOT'),game).condition).toBe(true);
  expect(game.animBlocks.count).toBe(1);
 });

 test('each request holds the block, and it goes when the last hold does',()=>{
  const game=new ScmGameState();
  run(withName(scmOpcode('REQUEST_ANIMATION'),'BENCH'),game);
  run(withName(scmOpcode('REQUEST_ANIMATION'),'BENCH'),game);
  game.animBlocks.load('BENCH');
  expect(game.animBlocks.references('BENCH')).toBe(2);
  run(withName(scmOpcode('REMOVE_ANIMATION'),'BENCH'),game);
  expect(game.animBlocks.references('BENCH')).toBe(1);
  expect(game.animBlocks.hasLoaded('BENCH')).toBe(true);
  run(withName(scmOpcode('REMOVE_ANIMATION'),'BENCH'),game);
  expect(game.animBlocks.references('BENCH')).toBe(0);
  expect(game.animBlocks.hasLoaded('BENCH')).toBe(false);
 });

 test('removing a block nobody asked for does nothing',()=>{
  const game=new ScmGameState();
  run(withName(scmOpcode('REMOVE_ANIMATION'),'NOTHING'),game);
  expect(game.animBlocks.count).toBe(0);
 });
});
