import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmThread,UnsupportedScmCommand} from '../src/engine/ScmThread';
import {decodeScmInstruction,readScmHeader} from '../src/assets/scm';

const int=(n:number)=>{const a=new Uint8Array(5);a[0]=1;new DataView(a.buffer).setInt32(1,n,true);return [...a];};
const float=(n:number)=>{const a=new Uint8Array(5);a[0]=6;new DataView(a.buffer).setFloat32(1,n,true);return [...a];};
const local=(n:number)=>[3,n&255,n>>8];
const global=(n:number)=>[2,n&255,n>>8];
const op=(n:number,...args:number[][])=>[n&255,n>>8,...args.flat()];
const space=(code:number[],entry=128)=>{const a=new Uint8Array(entry+code.length);a.set(code,entry);return a;};

test('SCM integer overflow, signed division, float rounding and shared global storage',()=>{
 const code=[...op(6,local(0),int(2147483647)),...op(10,local(0),int(1)),...op(6,local(1),int(-7)),...op(22,local(1),int(3)),...op(7,local(2),float(16777216)),...op(11,local(2),float(1)),...op(4,global(8),local(0)),...op(0x4e)];
 const bytes=space(code),thread=new ScmThread(bytes,128);
 expect(thread.run(0)).toBe('terminated');
 expect(thread.locals.getInt32(0,true)).toBe(-2147483648);
 expect(thread.locals.getInt32(4,true)).toBe(-2);
 expect(thread.locals.getFloat32(8,true)).toBe(16777216);
 expect(new DataView(bytes.buffer).getInt32(8,true)).toBe(-2147483648);
});

test('WAIT zero yields, a later wait resumes only at its native millisecond deadline',()=>{
 const code=[...op(1,int(0)),...op(6,local(0),int(3)),...op(1,int(10)),...op(10,local(0),int(4)),...op(0x4e)];
 const thread=new ScmThread(space(code),128);
 expect(thread.run(100)).toBe('waiting');expect(thread.locals.getInt32(0,true)).toBe(0);
 expect(thread.run(100)).toBe('waiting');expect(thread.locals.getInt32(0,true)).toBe(3);
 const ip=thread.ip;expect(thread.run(109)).toBe('waiting');expect(thread.ip).toBe(ip);
 expect(thread.run(110)).toBe('terminated');expect(thread.locals.getInt32(0,true)).toBe(7);
});

test('mission-relative GOSUB and RETURN preserve the instruction after the call',()=>{
 const base=128,call=op(0x50,int(-16)),halt=op(0x4e);
 const code=[...call,...halt];while(code.length<16)code.push(0);
 code.push(...op(6,local(0),int(42)),...op(0x51));
 const thread=new ScmThread(space(code),base,base);
 expect(thread.run(0)).toBe('terminated');expect(thread.locals.getInt32(0,true)).toBe(42);expect(thread.stack).toEqual([]);
});

test('AND/OR conditions apply opcode negation and consume the requested comparison count',()=>{
 const eq=(a:number,b:number,not=false)=>op(56|(not?0x8000:0),int(a),int(b));
 const thread=new ScmThread(space([...op(0xd6,int(1)),...eq(1,1),...eq(2,3,true),...op(1,int(0)),...op(0xd6,int(21)),...eq(1,2),...eq(1,1),...op(0x4e)]),128);
 expect(thread.run(0)).toBe('waiting');expect(thread.condition).toBe(true);expect(thread.logical).toBe(0);
 expect(thread.run(0)).toBe('terminated');expect(thread.condition).toBe(true);expect(thread.logical).toBe(0);
});

test('false conditions branch to absolute script-space addresses, skipping invalid data',()=>{
 const bytes=space([...op(56,int(1),int(2)),...op(0x4d,int(160)),255,127,...Array(15).fill(255),...op(0x4e)]);
 bytes.set(op(0x4e),160);
 const thread=new ScmThread(bytes,128);expect(thread.run(0)).toBe('terminated');expect(thread.ip).toBe(162);
 expect(decodeScmInstruction(new Uint8Array([0,0,255,127]),0).name).toBe('NOP');
});

test('unsupported native commands stop at their original address without faking success',()=>{
 const bytes=space(op(3,int(5))),thread=new ScmThread(bytes,128);
 expect(()=>thread.run(0)).toThrow(UnsupportedScmCommand);expect(thread.ip).toBe(128);expect(thread.terminated).toBe(false);
 const original=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),header=readScmHeader(original);
 const main=new ScmThread(original,header.entry);
 try{main.run(0);throw new Error('Expected an unimplemented native command');}
 catch(error){expect(error).toBeInstanceOf(UnsupportedScmCommand);expect(error).toMatchObject({offset:55987,opcode:0x16a,command:'DO_FADE'});expect(main.name).toBe('MAIN');expect(main.ip).toBe(55987);}
});

test('invalid control flow and runaway loops fail rather than continuing with corrupt state',()=>{
 expect(()=>new ScmThread(space(op(0x51)),128).run(0)).toThrow('underflow');
 expect(()=>new ScmThread(space(op(0x50,int(128))),128).run(0)).toThrow('overflow');
 expect(()=>new ScmThread(space(op(2,int(128))),128).run(0,20)).toThrow('watchdog');
 expect(()=>new ScmThread(space(op(6,local(34),int(1))),128).run(0)).toThrow('variable out of bounds');
});

const array=(scope:7|8,base:number,index:number,globalIndex=false,count=1)=>[scope,base&255,base>>8,index&255,index>>8,count,globalIndex?128:0];

test('numeric arrays use live signed indexes across global and local storage',()=>{
 const bytes=space([
  ...op(6,local(0),int(2)),...op(4,global(4),int(1)),
  ...op(6,array(8,2,0),int(42)),...op(4,array(7,16,4,true),local(4)),
  ...op(6,local(0),int(-1)),...op(6,array(8,6,0),array(7,16,4,true)),...op(0x4e)
 ]);
 const thread=new ScmThread(bytes,128);thread.run(0);
 expect(thread.locals.getInt32(16,true)).toBe(42);
 expect(thread.locals.getInt32(20,true)).toBe(42);
 expect(new DataView(bytes.buffer).getInt32(20,true)).toBe(42);
 expect(()=>new ScmThread(space([...op(6,local(0),int(-1)),...op(6,array(8,0,0),int(1))]),128).run(0)).toThrow('array address');
});

test.each(Array.from({length:32},(_,i)=>88+i))('variable arithmetic opcode %i preserves numeric kind',opcode=>{
 const kind=opcode%2===0?'int':'float',initial=kind==='int'?int:float;
 const thread=new ScmThread(space([...op(kind==='int'?6:7,local(0),initial(9)),...op(kind==='int'?6:7,local(1),initial(2)),...op(opcode,local(0),local(1)),...op(0x4e)]),128);
 thread.run(0);
 const result=kind==='int'?thread.locals.getInt32(0,true):thread.locals.getFloat32(0,true);
 expect(result).toBe(opcode<=95?11:opcode<=103?7:opcode<=111?18:kind==='int'?4:4.5);
});

test('conversion truncates float to signed int, copies preserve bits, and timed arithmetic uses native timestep',()=>{
 const thread=new ScmThread(space([
  ...op(7,local(0),float(-7.75)),...op(146,local(1),local(0)),...op(147,local(2),local(1)),
  ...op(149,local(1)),...op(135,local(3),local(0)),...op(121,local(3),float(2)),...op(127,local(3),float(1)),...op(0x4e)
 ]),128);
 thread.run(0,100,0.5);
 expect(thread.locals.getInt32(4,true)).toBe(7);
 expect(thread.locals.getFloat32(8,true)).toBe(-7);
 expect(thread.locals.getFloat32(12,true)).toBe(-7.25);
 const invalid=new ScmThread(space([...op(7,local(0),float(2147483648)),...op(146,local(1),local(0))]),128);
 expect(()=>invalid.run(0)).toThrow('conversion out of range');
});
