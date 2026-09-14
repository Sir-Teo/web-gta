import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {readCol} from '../src/assets/col';
import type {ScenePart} from '../src/assets/scene';
import type {ObjectDataRecord} from '../src/assets/objectData';
import type {SurfaceInfoRecord} from '../src/assets/surfaceInfo';
import {nativePlantFriendly,nativeScenePlantEntities} from '../src/world/nativeScenePlants';
const info=new Map([[1,{values:{procPlant:0,procObj:1}} as SurfaceInfoRecord]]);
function part():ScenePart{
 const collision=readCol(new Uint8Array(readFileSync('tests/fixtures/dragonff-collision-v3.col')))[0];collision.mesh.materials=new Uint8Array([0,1]);
 return {name:'terrain',collision,definition:{section:'objs',drawDistance:100},placements:[{modelId:1,modelName:'terrain',instanceType:0,interior:0,position:[10,20,30],rotation:[0,0,0,1],lodIndex:-1}],sourceRefs:[{namespace:'primary',index:12,sourceName:'COUNTRY.ipl',format:'text'}]} as ScenePart;
}
test('plant-friendly flags scan every triangle and include object-only surfaces',()=>{
 expect(nativePlantFriendly(part().collision,info)).toBe(true);
 expect(nativePlantFriendly(part().collision,new Map())).toBe(false);
 expect(nativePlantFriendly(undefined,info)).toBe(false);
});
test('scene adapter preserves source identity, native coordinates and shared area 13',()=>{
 const source=part(),entities=nativeScenePlantEntities([source],info,new Map(),0);
 expect(entities).toHaveLength(1);expect(entities[0].identity).toBe('["country.ipl",12]');
 expect(entities[0].matrix.elements.slice(12,15)).toEqual([10,20,30]);
 expect(entities[0].inCurrentArea).toBe(true);
 source.placements[0].interior=1;expect(nativeScenePlantEntities([source],info,new Map(),0)[0].inCurrentArea).toBe(false);
 source.placements[0].interior=13;expect(nativeScenePlantEntities([source],info,new Map(),0)[0].inCurrentArea).toBe(true);
});
test('timed models, OBJECT.DAT dummies and distance big buildings are excluded',()=>{
 const source=part();source.definition!.section='tobj';expect(nativeScenePlantEntities([source],info,new Map(),0)).toEqual([]);
 source.definition!.section='objs';expect(nativeScenePlantEntities([source],info,new Map([['terrain',{} as ObjectDataRecord]]),0)).toEqual([]);
 source.definition!.drawDistance=301;expect(nativeScenePlantEntities([source],info,new Map(),0)).toEqual([]);
 source.definition!.drawDistance=100;source.sourceRefs=undefined;expect(()=>nativeScenePlantEntities([source],info,new Map(),0)).toThrow('source identities');
});
