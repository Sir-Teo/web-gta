import {test,expect} from 'vitest';
import {NativeProcObjectPool} from '../src/world/NativeProcObjectPool';
test('initial slot order and triangle removal preserve native rule/list ordering',()=>{
 const released:number[]=[],counts={temporaryObjects:7},pool=new NativeProcObjectPool([8,8,9],counts,(id:number)=>released.push(id));
 const a={},b={},slots:number[]=[];
 const add=(rule:number,owner:object,kind:'building'|'object'='object')=>pool.allocate(rule,owner,kind,true,id=>{slots.push(id);return id;});
 add(1,a);add(0,a);add(0,b);add(0,a);add(2,a,'building');
 expect(slots).toEqual([511,510,509,508,507]);expect(pool.removeTriangle(a,8)).toBe(3);
 expect(released).toEqual([508,510,511]);expect(counts.temporaryObjects).toBe(8);expect(pool.snapshot().matrices).toBe(2);
 add(0,b);expect(slots.at(-1)).toBe(511);expect(pool.removeTriangle(a,8)).toBe(0);
 expect(pool.removeTriangle(a,9)).toBe(1);expect(pool.removeTriangle(b,8)).toBe(2);
 expect(pool.snapshot()).toEqual({free:512,active:0,detached:0,matrices:0,temporaryObjects:7});
});
test('matrix capacity rejects aligned entries after removing a slot, but admits unaligned buildings',()=>{
 const pool=new NativeProcObjectPool([8],{temporaryObjects:0},()=>{}),owner={};
 for(let i=0;i<200;i++)expect(pool.allocate(0,owner,'building',true,()=>i)).toBe(true);
 let called=false;expect(pool.allocate(0,owner,'building',true,()=>{called=true;return 0;})).toBe(false);expect(called).toBe(false);
 expect(pool.allocate(0,owner,'building',false,()=>1)).toBe(true);
 expect(pool.snapshot()).toMatchObject({active:201,matrices:200,detached:1,free:310});
 pool.removeTriangle(owner,8);expect(pool.snapshot()).toMatchObject({free:511,active:0,matrices:0,detached:1});
});
test('temporary-object cap includes external objects and rejects before transform allocation',()=>{
 const counts={temporaryObjects:149},pool=new NativeProcObjectPool([8],counts,()=>{}),owner={};
 let calls=0;const create=()=>++calls;
 expect(pool.allocate(0,owner,'object',false,create)).toBe(true);
 expect(pool.allocate(0,owner,'object',false,create)).toBe(false);
 expect(pool.allocate(0,owner,'building',false,create)).toBe(true);expect(calls).toBe(2);
 expect(pool.removeTriangle(owner,8)).toBe(2);expect(counts.temporaryObjects).toBe(149);
 expect(pool.snapshot().detached).toBe(1);
});
test('failed entity allocation and exhausted pool do not create or own objects',()=>{
 const pool=new NativeProcObjectPool([8],{temporaryObjects:0},()=>{});let calls=0;
 for(let i=0;i<512;i++)expect(pool.allocate(0,{},'building',false,()=>{calls++;return null;})).toBe(false);
 expect(pool.allocate(0,{},'building',false,()=>{calls++;return 1;})).toBe(false);expect(calls).toBe(512);
 expect(pool.snapshot()).toEqual({free:0,active:0,detached:512,matrices:0,temporaryObjects:0});
});
test('cleanup errors finish ownership removal and report failure without double destruction',()=>{
 let calls=0;const owner={},pool=new NativeProcObjectPool([8],{temporaryObjects:0},()=>{calls++;throw Error('GPU disposal');});
 for(let i=0;i<3;i++)pool.allocate(0,owner,'object',true,()=>i);
 expect(()=>pool.removeTriangle(owner,8)).toThrow('cleanup failed');expect(calls).toBe(3);
 expect(pool.removeTriangle(owner,8)).toBe(0);expect(pool.snapshot()).toEqual({free:512,active:0,detached:0,matrices:0,temporaryObjects:0});
});
test('all 512 unaligned building slots can be occupied and subsequently reused',()=>{
 const pool=new NativeProcObjectPool([8],{temporaryObjects:0},()=>{}),owner={},ids=new Set<number>();
 for(let i=0;i<512;i++)expect(pool.allocate(0,owner,'building',false,id=>{ids.add(id);return id;})).toBe(true);
 expect(ids.size).toBe(512);expect(pool.allocate(0,owner,'building',false,()=>{throw Error('must not allocate');})).toBe(false);
 expect(pool.snapshot()).toMatchObject({active:512,free:0,detached:0});
 expect(pool.removeTriangle(owner,8)).toBe(512);expect(pool.allocate(0,owner,'building',false,id=>id)).toBe(true);
});
