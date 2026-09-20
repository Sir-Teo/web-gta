import {expect,test} from 'vitest';
import {rehydrateResidentParts,residentModelsOf,stripResidentParts} from '../src/assets/residentModels';
import type {ScenePart} from '../src/assets/scene';
const part=(name:string):ScenePart=>({name,model:{frames:[],geometries:[{positions:new Float32Array(3),uvs:[],indices:new Uint32Array(3),materialIds:new Uint16Array(1),materials:[],flags:0}],atomics:[],warnings:[]},textures:[{name:'t',mips:[]} as never],dictionaryNames:[],notices:[],placements:[],collisionSource:undefined,collision:undefined} as unknown as ScenePart);
test('a resident model\'s part travels without its payload and gets the held copy back before installing',()=>{
 const held=residentModelsOf([part('Lawn'),part('house')]);
 expect([...held.keys()]).toEqual(['lawn','house']);
 const {parts,stripped}=stripResidentParts([part('lawn'),part('Tree')],new Set(['lawn']));
 expect(stripped).toBe(1);expect(parts[0]).toMatchObject({resident:true,textures:[]});expect(parts[0].model.geometries).toEqual([]);expect(parts[1].resident).toBeUndefined();
 expect(rehydrateResidentParts(parts,held)).toEqual([]);
 expect(parts[0].model).toBe(held.get('lawn')!.model);expect(parts[0].textures).toBe(held.get('lawn')!.textures);expect(parts[0].resident).toBeUndefined();
 // A stripped part the cache does not hold is reported instead of installed empty.
 const {parts:orphan}=stripResidentParts([part('shop')],new Set(['shop']));
 expect(rehydrateResidentParts(orphan,held)).toEqual(['shop']);
 // A stripped part never counts as held.
 expect([...residentModelsOf(orphan).keys()]).toEqual([]);
});
