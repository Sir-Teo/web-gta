import {expect,test,vi} from 'vitest';
import {NativePlantPool} from '../src/world/NativePlantPool';
import {nativePlantTriangle} from '../src/world/nativePlantTriangle';
import type {NativePlantCandidate} from '../src/world/nativePlantCollision';
const camera=[0,0,0] as const;
const candidate=(index:number,objects=false,grass=true):NativePlantCandidate=>({index,surface:1,lighting:0xff,triangle:nativePlantTriangle([0,0,0],[3,0,0],[0,4,0]),counts:grass?{maximum:[6,0,0],draw:[8,0,0]}:undefined,createsPlants:grass,createsObjects:objects,slot:grass?0:3});
const hooks=()=>({randomSample:vi.fn(()=>.25),addObjects:vi.fn(()=>false),removeObjects:vi.fn()});

test('retained triangles preserve allocations and seeds; released slots return to the head',()=>{
 const callbacks=hooks(),pool=new NativePlantPool(callbacks),a=candidate(0),b=candidate(1);
 pool.updateEntity('terrain',camera,[a,b,a]);
 const before=pool.triangles();expect(before.map(t=>t.id)).toEqual([1,0]);expect(callbacks.randomSample).toHaveBeenCalledTimes(6);
 pool.updateEntity('terrain',camera,[a,b]);expect(pool.triangles()).toEqual(before);expect(callbacks.randomSample).toHaveBeenCalledTimes(6);
 pool.updateEntity('terrain',[1000,0,0],[],0);expect(pool.triangles().map(t=>t.candidate.index)).toEqual([1]);
 pool.updateEntity('terrain',camera,[a],0);expect(pool.triangles().map(t=>t.id)).toEqual([0,1]);expect(callbacks.randomSample).toHaveBeenCalledTimes(9);
 pool.releaseEntity('terrain');expect(pool.size).toBe(0);
 pool.updateEntity('next',camera,[candidate(2)]);expect(pool.triangles()[0].id).toBe(1);
});

test('object retries precede phase filtering and successful objects release exactly once',()=>{
 const callbacks=hooks(),pool=new NativePlantPool(callbacks);
 pool.updateEntity('terrain',camera,[candidate(1,true)]);expect(callbacks.addObjects).toHaveBeenCalledTimes(1);
 callbacks.addObjects.mockReturnValue(true);
 pool.updateEntity('terrain',[1000,0,0],[],0);expect(callbacks.addObjects).toHaveBeenCalledTimes(2);expect(pool.size).toBe(1);
 pool.updateEntity('terrain',[1000,0,0],[],1);expect(pool.size).toBe(0);expect(callbacks.removeObjects).toHaveBeenCalledTimes(1);
 pool.releaseEntity('terrain');expect(callbacks.removeObjects).toHaveBeenCalledTimes(1);
});

test('failed object-only additions release immediately and consume no grass seeds',()=>{
 const callbacks=hooks(),pool=new NativePlantPool(callbacks);
 pool.updateEntity('terrain',camera,[candidate(0,true,false)]);expect(pool.size).toBe(0);expect(callbacks.randomSample).not.toHaveBeenCalled();
 callbacks.addObjects.mockReturnValue(true);
 pool.updateEntity('terrain',camera,[candidate(0,true,false)]);expect(pool.triangles()[0]).toMatchObject({id:0,seeds:[],createdObjects:true});
 pool.releaseEntity('terrain');expect(callbacks.removeObjects).toHaveBeenCalledTimes(1);
});

test('one 256-slot pool is shared across entities and preserves render slot ordering',()=>{
 const callbacks=hooks(),pool=new NativePlantPool(callbacks);
 pool.updateEntity('first',camera,Array.from({length:255},(_,i)=>candidate(i)));
 pool.updateEntity('second',camera,[{...candidate(0),slot:2},candidate(1)]);
 expect(pool.size).toBe(256);expect(pool.triangles().at(-1)).toMatchObject({entity:'second',id:255,candidate:{index:0,slot:2}});
 expect(callbacks.randomSample).toHaveBeenCalledTimes(768);
 pool.releaseEntity('first');expect(pool.size).toBe(1);
 pool.updateEntity('second',camera,[candidate(1)]);expect(pool.triangles()[0]).toMatchObject({id:254,candidate:{index:1}});
});

test('invalid random samples fail before claiming a pool slot',()=>{
 const callbacks=hooks(),pool=new NativePlantPool(callbacks);callbacks.randomSample.mockReturnValue(NaN);
 expect(()=>pool.updateEntity('terrain',camera,[candidate(0)])).toThrow('random sample');expect(pool.size).toBe(0);
 callbacks.randomSample.mockReturnValue(1);pool.updateEntity('terrain',camera,[candidate(0)]);
 expect(pool.triangles()[0]).toMatchObject({id:0,seeds:[1,1,1]});
});
