import {expect,test} from 'vitest';
import {ScmRuntime} from '../src/engine/ScmRuntime';
const int=(n:number)=>{const a=new Uint8Array(5);a[0]=1;new DataView(a.buffer).setInt32(1,n,true);return [...a];};
const float=(n:number)=>{const a=new Uint8Array(5);a[0]=6;new DataView(a.buffer).setFloat32(1,n,true);return [...a];};
const local=(n:number)=>[3,n&255,n>>8],global=(n:number)=>[2,n&255,n>>8];
const op=(n:number,...args:number[][])=>[n&255,n>>8,...args.flat()];

test('new threads wait until the next pass; existing threads continue in linked-list order',()=>{
 const bytes=new Uint8Array(512),globals=new DataView(bytes.buffer);
 bytes.set([...op(6,local(0),int(9)),...op(0x4f,int(256),int(7),float(1.25),local(0)),0,...op(6,local(0),int(20)),...op(4,global(8),int(100)),...op(1,int(50)),...op(0x4e)],128);
 bytes.set([...op(4,global(12),local(2)),...op(8,global(8),int(10)),...op(0x4e)],256);
 bytes.set([...op(8,global(8),int(1)),...op(0x4e)],384);
 const runtime=new ScmRuntime(bytes),older=runtime.start(384),parent=runtime.start(128);
 expect([older.id,parent.id]).toEqual([95,94]);
 runtime.process(10,16.6667);
 expect(globals.getInt32(8,true)).toBe(101); // parent then the existing older thread
 const child=runtime.active[0];expect(child.id).toBe(93);
 expect(child.thread.ip).toBe(256);expect(child.thread.locals.getInt32(128,true)).toBe(0);
 expect(child.thread.locals.getInt32(0,true)).toBe(7);
 expect(child.thread.locals.getFloat32(4,true)).toBe(1.25);
 expect(child.thread.locals.getInt32(8,true)).toBe(9); // copied before parent changed it
 expect(parent.thread.locals.getInt32(128,true)).toBe(16);
 runtime.process(20,16.6667);
 expect(globals.getInt32(8,true)).toBe(111);expect(globals.getInt32(12,true)).toBe(9);
 expect(runtime.active.map(s=>s.id)).toEqual([94]);
 expect(parent.thread.locals.getInt32(128,true)).toBe(32); // sleeping, but timers run
 runtime.process(60,40);expect(runtime.active).toEqual([]);
 expect(runtime.headName).toBeUndefined();
 const reused=runtime.start(384);expect(reused.id).toBe(94);
 // pActiveScripts' head is the thread started last.
 reused.thread.name='first';const later=runtime.start(384);later.thread.name='strap3';expect(runtime.headName).toBe('strap3');
 runtime.terminateAllWithName('strap3');expect(runtime.headName).toBe('first');reused.thread.name='noname';
 expect(reused.thread.name).toBe('noname');expect(reused.thread.locals.getInt32(0,true)).toBe(0);
 expect(reused.thread.locals.getInt32(128,true)).toBe(0);
});

test('local timers truncate each frame to integer milliseconds and wrap as int32',()=>{
 const bytes=new Uint8Array(160);bytes.set([...op(1,int(1000)),...op(0x4e)],128);
 const runtime=new ScmRuntime(bytes),{thread}=runtime.start(128);
 thread.locals.setInt32(128,2147483640,true);thread.locals.setInt32(132,-5,true);
 runtime.process(10,10.9);
 expect(thread.locals.getInt32(128,true)).toBe(-2147483646);
 expect(thread.locals.getInt32(132,true)).toBe(5);
 runtime.process(20,.9);expect(thread.locals.getInt32(132,true)).toBe(5);
 expect(thread.terminated).toBe(false);
});

test('script pool is bounded at 96 and terminated slots are available again',()=>{
 const bytes=new Uint8Array(130);bytes.set(op(0x4e),128);
 const runtime=new ScmRuntime(bytes);
 for(let i=0;i<96;i++)runtime.start(128);
 expect(()=>runtime.start(128)).toThrow('pool exhausted');expect(runtime.active).toHaveLength(96);
 runtime.process(0,0);expect(runtime.active).toHaveLength(0);
 expect(runtime.start(128).id).toBe(95);
});

test('a failed start leaves parent IP and existing active threads intact',()=>{
 const bytes=new Uint8Array(150);bytes.set([...op(0x4f,int(999)),0,...op(0x4e)],128);
 const runtime=new ScmRuntime(bytes),{thread}=runtime.start(128);
 expect(()=>runtime.process(0,0)).toThrow('address out of bounds');
 expect(thread.ip).toBe(128);expect(runtime.active).toHaveLength(1);
 expect(()=>runtime.start(128,Array(35).fill(0))).toThrow('local storage');expect(runtime.active).toHaveLength(1);
});
