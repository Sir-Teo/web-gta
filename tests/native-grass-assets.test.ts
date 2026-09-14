import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect,test} from 'vitest';
import {NATIVE_GRASS_FILES,readNativeGrassAssets,bindNativeGrassCover} from '../src/assets/nativeGrassAssets';

test('grass package rejects missing resources instead of retaining embedded texture guesses',()=>{
 expect(()=>readNativeGrassAssets(new Map())).toThrow('plant1.txd');
});

test.skipIf(!process.env.GTA_CONTENT_DIR)('native grass package prepares independent cover materials over original geometry',async()=>{
 const files=new Map(await Promise.all([...NATIVE_GRASS_FILES,'plant1.txd'].map(async name=>[name,new Uint8Array(await readFile(join(process.env.GTA_CONTENT_DIR!,'models/grass',name)))] as const)));
 const assets=readNativeGrassAssets(files);expect(assets.models).toHaveLength(8);expect(assets.textures).toHaveLength(9);
 for(const {source,model} of assets.models){
  expect(source.atomics).toHaveLength(1);expect(model.atomics).toHaveLength(1);expect(model.frames).toHaveLength(1);
  expect(model.frames[0].matrix).toEqual([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  const geometry=model.geometries[0];expect(geometry.positions).toBe(source.geometries[0].positions);expect(geometry.indices).toBe(source.geometries[0].indices);
  expect(geometry.flags&0x78).toBe(0x48);expect(geometry.colors?.every(value=>value===255)).toBe(true);
  expect(geometry.colors).not.toBe(source.geometries[0].colors);
  for(const material of geometry.materials)expect(material).toMatchObject({color:[0,0,0,50],texture:'gras07Si',filter:2,addressU:1,addressV:1});
 }
 for(const texture of assets.textures)expect(texture).toMatchObject({sourceDictionary:'plant1.txd',filter:2,addressU:1,addressV:1});
 const originalMaterials=structuredClone(assets.models.map(entry=>entry.source.geometries.map(geometry=>geometry.materials)));
 for(let slot=0;slot<4;slot++)for(let model=0;model<4;model++)for(let texture=0;texture<4;texture++){
  const bound=bindNativeGrassCover(assets,slot,{model,texture},[34,32,25,20]);
  expect(bound.sourceModel).toBe(`grass0_${model+1}.dff`);
  expect(bound.textures[0].name.toLowerCase()).toBe(`txgrass${slot%2}_${texture}`);
  expect(bound.model.geometries[0].positions).toBe(assets.models[model].source.geometries[0].positions);
  for(const material of bound.model.geometries[0].materials){expect(material.texture).toBe(bound.textures[0].name);expect(material.color).toEqual([34,32,25,20]);}
 }
 expect(assets.models.map(entry=>entry.source.geometries.map(geometry=>geometry.materials))).toEqual(originalMaterials);
 expect(assets.models[0].model.geometries[0].materials[0].color).toEqual([0,0,0,50]);
 expect(()=>bindNativeGrassCover(assets,0,{model:65535,texture:0},[0,0,0,0])).toThrow('binding');
 files.delete('grass1_4.dff');expect(()=>readNativeGrassAssets(files)).toThrow('grass1_4.dff');
});
