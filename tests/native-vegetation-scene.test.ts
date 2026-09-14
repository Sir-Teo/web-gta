import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {Matrix4} from 'three';
import {readCol} from '../src/assets/col';
import {readPlants} from '../src/assets/vegetation';
import {nativeSurfaceId} from '../src/assets/surfaceIds';
import type {SurfaceInfoRecord} from '../src/assets/surfaceInfo';
import {initializeNativePlants} from '../src/world/nativeVegetation';
import {NativeVegetationScene} from '../src/world/NativeVegetationScene';
import type {NativePlantEntity} from '../src/world/NativePlantEntityCache';

test('vegetation session retains allocations until deleted references are processed and disposes completely',()=>{
 const collision=readCol(new Uint8Array(readFileSync('tests/fixtures/dragonff-collision-v3.col')))[0],surface=nativeSurfaceId('GRASS_SHORT_LUSH');
 collision.flags=0;collision.bounds={min:[0,0,0],max:[3,4,0],center:[1,1,0],radius:4};
 collision.mesh={positions:new Float32Array([0,0,0,3,0,0,0,4,0]),indices:new Uint32Array([0,1,2]),materials:new Uint8Array([surface]),lights:new Uint8Array([0xff])};
 const entity:NativePlantEntity={identity:'ground',collision,matrix:new Matrix4(),atomic:true,plantFriendly:true,procedural:false,scanCurrent:false,inCurrentArea:true};
 const plants=initializeNativePlants(readPlants('GRASS_SHORT_LUSH 0 0 0 0 220 210 165 160 0 40 1 1 0 0 1 0 1'));
 const info=new Map([[surface,{values:{procPlant:1,procObj:0}} as SurfaceInfoRecord]]);
 const scene=new NativeVegetationScene([entity],{models:[],textures:[]},plants,info,{randomSample:()=>.5,addObjects:()=>false,removeObjects:()=>{}},()=>[0,0,0,0,0]);
 scene.simulate([0,0,0]);const allocations=scene.allocations();expect(allocations).toHaveLength(1);expect(scene.cachedEntityCount).toBe(1);
 scene.simulate([0,0,0],true,1);expect(scene.allocations()[0]).toBe(allocations[0]);
 expect(()=>scene.simulate([0,0,0],false,8)).toThrow('update');expect(scene.allocations()[0]).toBe(allocations[0]);
 scene.removeEntity('ground');expect(scene.entityCount).toBe(0);expect(scene.allocations()).toHaveLength(1);
 scene.simulate([0,0,0],true,1);expect(scene.cachedEntityCount).toBe(0);expect(scene.allocations()).toHaveLength(0);
 scene.dispose();scene.dispose();scene.simulate([0,0,0]);expect(scene.root.children).toHaveLength(0);expect(scene.cachedEntityCount).toBe(0);
});
