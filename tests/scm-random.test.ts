import {expect,test} from 'vitest';
import {ScmRuntime} from '../src/engine/ScmRuntime';
import {ScmThread,UnsupportedScmCommand} from '../src/engine/ScmThread';
import {WindowsCrtRandom} from '../src/core/WindowsCrtRandom';
const int=(n:number)=>{const a=new Uint8Array(5);a[0]=1;new DataView(a.buffer).setInt32(1,n,true);return [...a];};
const float=(n:number)=>{const a=new Uint8Array(5);a[0]=6;new DataView(a.buffer).setFloat32(1,n,true);return [...a];};
const local=(n:number)=>[3,n,0];
const op=(n:number,...args:number[][])=>[n&255,n>>8,...args.flat()];

test('SCM random commands consume one shared CRT stream in scheduler order',()=>{
 const bytes=new Uint8Array(300),code=[...op(153,local(0)),...op(0x4e)];bytes.set(code,128);bytes.set(code,192);
 const runtime=new ScmRuntime(bytes,undefined,new WindowsCrtRandom(1));
 const first=runtime.start(128).thread,second=runtime.start(192).thread;runtime.process(0,20);
 expect(second.locals.getInt32(0,true)).toBe(41);expect(first.locals.getInt32(0,true)).toBe(18467);
 const unavailable=new ScmThread(bytes,128);expect(()=>unavailable.run(0)).toThrow(UnsupportedScmCommand);expect(unavailable.ip).toBe(128);
});

test('native random range endpoints include the float maximum and exclude the integer maximum',()=>{
 const bytes=new Uint8Array(300);bytes.set([
  ...op(520,float(-2),float(8),local(0)),...op(520,float(-2),float(8),local(1)),
  ...op(521,int(-10),int(10),local(2)),...op(521,int(-10),int(10),local(3)),...op(0x4e)
 ],128);
 const samples=[0,32767,0,32767],runtime=new ScmRuntime(bytes,undefined,{next:()=>samples.shift()!}),thread=runtime.start(128).thread;
 runtime.process(0,20);
 expect(thread.locals.getFloat32(0,true)).toBe(-2);expect(thread.locals.getFloat32(4,true)).toBe(8);
 expect(thread.locals.getInt32(8,true)).toBe(-10);expect(thread.locals.getInt32(12,true)).toBe(9);expect(samples).toEqual([]);
});
