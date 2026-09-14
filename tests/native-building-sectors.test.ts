import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {Matrix4} from 'three';
import {readCol} from '../src/assets/col';
import {NativeBuildingSectors,nativeBuildingRectangle} from '../src/world/NativeBuildingSectors';
import {NativePlantEntityCache,type NativePlantEntity} from '../src/world/NativePlantEntityCache';
import {NativePlantPool} from '../src/world/NativePlantPool';
function entity(identity:string,x=0,y=0):NativePlantEntity{
 const collision=readCol(new Uint8Array(readFileSync('tests/fixtures/dragonff-collision-v3.col')))[0];
 collision.bounds.min=[1,1,0];collision.bounds.max=[2,2,1];collision.bounds.center=[1,1,0];collision.bounds.radius=2;
 return {identity,collision,matrix:new Matrix4().makeTranslation(x,y,0),inCurrentArea:true,procedural:false,atomic:true,plantFriendly:true,scanCurrent:false};
}
test('building scans preserve row/column ordering and head insertion',()=>{
 const sectors=new NativeBuildingSectors();
 for(const e of [entity('north',0,50),entity('east',50,0),entity('first'),entity('last')])sectors.add(e,false);
 expect([...sectors.scan([0,0,0])].map(e=>e.identity)).toEqual(['last','first','east','north']);
 sectors.remove('last');expect([...sectors.scan([0,0,0])].map(e=>e.identity)).toEqual(['first','east','north']);
 sectors.clear();expect([...sectors.scan([0,0,0])]).toEqual([]);
});
test('inclusive sector boundaries retain duplicate visits and exclude big buildings',()=>{
 const sectors=new NativeBuildingSectors(),span=entity('span');span.collision.bounds.max[0]=50;
 sectors.add(span,false);sectors.add(entity('lod'),true);
 expect([...sectors.scan([0,0,0])].map(e=>e.identity)).toEqual(['span','span']);
 expect(()=>sectors.add(span,false)).toThrow('Duplicate');
 sectors.remove('span');expect([...sectors.scan([0,0,0])]).toEqual([]);
});
test('outlying scan coordinates clamp each sector access and preserve edge repeats',()=>{
 const sectors=new NativeBuildingSectors();sectors.add(entity('edge',-3000,-3000),false);
 expect([...sectors.scan([-3000,-3000,0])]).toHaveLength(64);
 sectors.remove('edge');expect([...sectors.scan([-3000,-3000,0])]).toEqual([]);
});
test('native bound rectangle uses paired Y/Z corners rather than an eight-corner projection',()=>{
 const e=entity('tilted');e.collision.bounds.min=[-1,-2,-3];e.collision.bounds.max=[1,2,3];
 e.matrix.set(1,0,0,10,0,1,-1,20,0,0,1,0,0,0,0,1);
 expect(nativeBuildingRectangle(e)).toEqual({left:9,right:11,bottom:19,top:21});
});
test('sector traversal feeds cache admission once per stable entity identity',()=>{
 const sectors=new NativeBuildingSectors(),entities=Array.from({length:41},(_,i)=>entity(String(i)));
 for(const e of entities){e.collision.bounds.max[0]=50;sectors.add(e,false);}
 const pool=new NativePlantPool({randomSample:()=>.5,addObjects:()=>false,removeObjects:()=>{}}),cache=new NativePlantEntityCache(pool);
 const lookup=new Map(entities.map(e=>[e.identity,e]));
 cache.update([0,0,0],false,sectors.scan([0,0,0]),id=>lookup.get(id));
 expect(cache.identities()).toEqual(Array.from({length:40},(_,i)=>String(i+1)));
});
