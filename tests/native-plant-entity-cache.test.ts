import {readFileSync} from 'node:fs';
import {expect,test,vi} from 'vitest';
import {Matrix4} from 'three';
import {readCol} from '../src/assets/col';
import {readPlants} from '../src/assets/vegetation';
import {nativeSurfaceId} from '../src/assets/surfaceIds';
import type {SurfaceInfoRecord} from '../src/assets/surfaceInfo';
import {initializeNativePlants} from '../src/world/nativeVegetation';
import {NativePlantPool} from '../src/world/NativePlantPool';
import {NativePlantEntityCache,nativePlantEntityDistanceSquared,type NativePlantEntity} from '../src/world/NativePlantEntityCache';
const camera=[0,0,0] as const;
function entity(identity:string):NativePlantEntity{
 const collision=readCol(new Uint8Array(readFileSync('tests/fixtures/dragonff-collision-v3.col')))[0];
 collision.bounds.center=[0,0,0];collision.bounds.radius=10;collision.flags=0;
 collision.mesh={positions:new Float32Array([0,0,0,3,0,0,0,4,0]),indices:new Uint32Array([0,1,2]),materials:new Uint8Array([nativeSurfaceId('GRASS_SHORT_LUSH')]),lights:new Uint8Array([0xff])};
 return {identity,collision,matrix:new Matrix4(),inCurrentArea:true,procedural:false,atomic:true,plantFriendly:true,scanCurrent:false};
}
function setup(){
 const hooks={randomSample:vi.fn(()=>.5),addObjects:vi.fn(()=>false),removeObjects:vi.fn()};
 const pool=new NativePlantPool(hooks),cache=new NativePlantEntityCache(pool);
 return {hooks,pool,cache};
}
test('entity distance uses transformed sphere center and preserves the inside-sphere branch',()=>{
 const e=entity('a');e.collision.bounds.center=[2,0,0];e.matrix.makeTranslation(3,0,0);
 expect(nativePlantEntityDistanceSquared(e,camera)).toBe(25);
 expect(nativePlantEntityDistanceSquared(e,[15,0,0])).toBe(100);
 expect(nativePlantEntityDistanceSquared(e,[16,0,0])).toBe(1);
 expect(nativePlantEntityDistanceSquared(e,[355,0,0])).toBe(340*340);
});
test('full cache scans apply eligibility and capacity with newest entries at the head',()=>{
 const {cache}=setup(),valid=Array.from({length:41},(_,i)=>entity(String(i)));
 const skipped=['procedural','scanCurrent'].map(flag=>({...entity(flag),[flag]:true}));
 skipped.push(...['atomic','plantFriendly','inCurrentArea'].map(flag=>({...entity(flag),[flag]:false})));
 const all=new Map([...skipped,...valid].map(e=>[e.identity,e])),resolve=(id:string)=>all.get(id);
 cache.update(camera,false,[...skipped,valid[0],...valid],resolve);
 expect(cache.identities()).toEqual(Array.from({length:40},(_,i)=>String(39-i)));
});
test('fast updates remove dead references only; full updates prune area and distance',()=>{
 const {cache}=setup(),a=entity('a'),b=entity('b'),c=entity('c'),d=entity('d');
 const all=new Map([a,b,c,d].map(e=>[e.identity,e])),resolve=(id:string)=>all.get(id);
 cache.update(camera,false,[a,b,c],resolve);
 all.delete('a');b.inCurrentArea=false;c.matrix.makeTranslation(351,0,0);
 cache.update(camera,true,[d],resolve);expect(cache.identities()).toEqual(['c','b']);
 cache.update(camera,false,[d],resolve);expect(cache.identities()).toEqual(['d']);
});
test('failed empty-collision addition terminates the supplied scan',()=>{
 const {cache}=setup(),empty=entity('empty');empty.collision.mesh.materials=new Uint8Array();
 cache.update(camera,false,[entity('first'),empty,entity('last')],()=>undefined);
 expect(cache.identities()).toEqual(['first']);
});
test('cached collision processing drives persistent grass and releases it with the entity',()=>{
 const {pool,cache,hooks}=setup(),a=entity('a'),resolve=(id:string)=>id==='a'?a:undefined;
 const id=nativeSurfaceId('GRASS_SHORT_LUSH'),info=new Map([[id,{values:{procPlant:1,procObj:0}} as SurfaceInfoRecord]]);
 const plants=initializeNativePlants(readPlants('GRASS_SHORT_LUSH 0 0 0 1 220 210 165 160 22 40 .5 .51 1.5 .65 5 1 1'));
 cache.update(camera,false,[a],resolve);cache.process(camera,resolve,info,plants);expect(pool.size).toBe(1);
 cache.process(camera,resolve,info,plants);expect(hooks.randomSample).toHaveBeenCalledTimes(3);
 a.collision.mesh.materials=new Uint8Array(2);
 cache.process([1000,0,0],resolve,info,plants);expect(pool.size).toBe(1); // native count mismatch skips removal and addition
 cache.clear();expect(pool.size).toBe(0);expect(cache.identities()).toEqual([]);
});
