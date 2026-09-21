import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {scmOpcode} from '../src/engine/scmOpcodes';

/** An instruction's bytes; operands are [type,value] pairs in the script's own encoding. */
function instruction(opcode:number,operands:readonly (readonly [number,number])[]){
 const parts:number[][]=[[opcode&0xff,opcode>>8&0xff]];
 for(const [type,value] of operands){
  const bytes=new Uint8Array(4),view=new DataView(bytes.buffer);
  if(type===1){view.setInt32(0,value,true);parts.push([1,...bytes]);}
  else if(type===4)parts.push([4,value&0xff]);
  else {view.setUint16(0,value,true);parts.push([type,bytes[0],bytes[1]]);}
 }
 return parts.flat();
}
const gvar=(offset:number)=>[2,offset] as const;
const lvar=(index:number)=>[3,index] as const;
const int8=(value:number)=>[4,value] as const;
const int32=(value:number)=>[1,value] as const;

/** Runs a stream of instructions over a fresh script space and returns what they left behind. The globals are
 * the start of that space, as they are in the file, so the code goes after them. */
const CODE=512;
function run(...instructions:number[][]){
 const space=new Uint8Array(2048);
 space.set(instructions.flat(),CODE);
 const view=new DataView(space.buffer);
 const host:ScmThreadHost={startScript(){},game:new ScmGameState(),world:{fade(){}} as ScmWorldCommands};
 const thread=new ScmThread(space,CODE,0,undefined,host);
 // The budget is an instruction count; the stream ends without a terminator, so the watchdog closes it.
 try{thread.run(0,64);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return {thread,global:(offset:number)=>view.getInt32(offset,true)};
}
const SET_GLOBAL=scmOpcode('SET_GLOBAL_VAR_BIT_CONST'),CLEAR_GLOBAL=scmOpcode('CLEAR_GLOBAL_VAR_BIT_CONST');
const IS_GLOBAL=scmOpcode('IS_GLOBAL_VAR_BIT_SET_CONST');

describe('the variable bits a script sets, clears and tests',()=>{
 test('a set bit lands in the variable itself and leaves its neighbours alone',()=>{
  const {global}=run(
   instruction(scmOpcode('SET_VAR_INT'),[gvar(40),int32(0)]),
   instruction(scmOpcode('SET_VAR_INT'),[gvar(44),int32(0)]),
   instruction(SET_GLOBAL,[gvar(40),int8(3)]),
   instruction(SET_GLOBAL,[gvar(40),int8(5)]),
  );
  expect(global(40)).toBe(0b101000);
  expect(global(44)).toBe(0);
 });

 test('clearing takes only that bit away',()=>{
  const {global}=run(
   instruction(scmOpcode('SET_VAR_INT'),[gvar(40),int32(0b1111)]),
   instruction(CLEAR_GLOBAL,[gvar(40),int8(2)]),
  );
  expect(global(40)).toBe(0b1011);
 });

 test('a test sets the compare flag, and the NOT form inverts it',()=>{
  const set=[instruction(scmOpcode('SET_VAR_INT'),[gvar(40),int32(0b10000)])];
  expect(run(...set,instruction(IS_GLOBAL,[gvar(40),int8(4)])).thread.condition).toBe(true);
  expect(run(...set,instruction(IS_GLOBAL,[gvar(40),int8(3)])).thread.condition).toBe(false);
  expect(run(...set,instruction(IS_GLOBAL|0x8000,[gvar(40),int8(4)])).thread.condition).toBe(false);
  expect(run(...set,instruction(IS_GLOBAL|0x8000,[gvar(40),int8(3)])).thread.condition).toBe(true);
 });

 test('the top bit is the sign bit, which the variable keeps',()=>{
  const {global}=run(
   instruction(scmOpcode('SET_VAR_INT'),[gvar(40),int32(0)]),
   instruction(SET_GLOBAL,[gvar(40),int8(31)]),
  );
  expect(global(40)).toBe(-2147483648);
  expect(run(instruction(scmOpcode('SET_VAR_INT'),[gvar(40),int32(-1)]),
   instruction(IS_GLOBAL,[gvar(40),int8(31)])).thread.condition).toBe(true);
 });

 test('a bit past the width wraps, as the shift it compiles to does',()=>{
  const {global}=run(
   instruction(scmOpcode('SET_VAR_INT'),[gvar(40),int32(0)]),
   instruction(SET_GLOBAL,[gvar(40),int32(33)]),
  );
  expect(global(40)).toBe(0b10);
 });

 test('the local forms reach the thread’s own variables rather than the globals',()=>{
  const {thread,global}=run(
   instruction(scmOpcode('SET_LVAR_INT'),[lvar(4),int32(0)]),
   instruction(scmOpcode('SET_LOCAL_VAR_BIT_CONST'),[lvar(4),int8(6)]),
   instruction(scmOpcode('IS_LOCAL_VAR_BIT_SET_CONST'),[lvar(4),int8(6)]),
  );
  expect(thread.condition).toBe(true);
  expect(global(16)).toBe(0);
  expect(run(instruction(scmOpcode('SET_LVAR_INT'),[lvar(4),int32(0)]),
   instruction(scmOpcode('SET_LOCAL_VAR_BIT_CONST'),[lvar(4),int8(6)]),
   instruction(scmOpcode('CLEAR_LOCAL_VAR_BIT_CONST'),[lvar(4),int8(6)]),
   instruction(scmOpcode('IS_LOCAL_VAR_BIT_SET_CONST'),[lvar(4),int8(6)])).thread.condition).toBe(false);
 });

 test('the bit can come from a global or a local variable instead of an immediate',()=>{
  const fromGlobal=run(
   instruction(scmOpcode('SET_VAR_INT'),[gvar(40),int32(0)]),
   instruction(scmOpcode('SET_VAR_INT'),[gvar(44),int32(9)]),
   instruction(scmOpcode('SET_GLOBAL_VAR_BIT_VAR'),[gvar(40),gvar(44)]),
   instruction(scmOpcode('IS_GLOBAL_VAR_BIT_SET_VAR'),[gvar(40),gvar(44)]),
  );
  expect(fromGlobal.global(40)).toBe(1<<9);
  expect(fromGlobal.thread.condition).toBe(true);
  const fromLocal=run(
   instruction(scmOpcode('SET_VAR_INT'),[gvar(40),int32(0)]),
   instruction(scmOpcode('SET_LVAR_INT'),[lvar(2),int32(12)]),
   instruction(scmOpcode('SET_GLOBAL_VAR_BIT_LVAR'),[gvar(40),lvar(2)]),
   instruction(scmOpcode('CLEAR_GLOBAL_VAR_BIT_LVAR'),[gvar(40),lvar(2)]),
  );
  expect(fromLocal.global(40)).toBe(0);
 });

 test('every one of the eighteen commands is reachable',()=>{
  for(const scope of ['GLOBAL','LOCAL'])for(const source of ['CONST','VAR','LVAR']){
   expect(scmOpcode(`IS_${scope}_VAR_BIT_SET_${source}`)).toBeGreaterThan(0);
   expect(scmOpcode(`SET_${scope}_VAR_BIT_${source}`)).toBeGreaterThan(0);
   expect(scmOpcode(`CLEAR_${scope}_VAR_BIT_${source}`)).toBeGreaterThan(0);
  }
 });
});
