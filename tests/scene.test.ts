import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { imgFixture } from './fixtures/native-assets';
import { readScene } from '../src/assets/scene';
const model = new Uint8Array(readFileSync('tests/fixtures/dragonff-model.dff'));
const texture = new Uint8Array(readFileSync('tests/fixtures/dragonff-model-textures.txd'));
const file = new File([imgFixture([{ name: 'first.dff', bytes: model }, { name: 'second.dff', bytes: model }, { name: 'shared.txd', bytes: texture }]) as BlobPart], 'scene.img');
const associations = ['first', 'second'].map((model, i) => ({ model, id: i + 1, dictionary: 'shared', section: 'objs' }));
const placementFile = new File(['inst\n1 first 0 0 0 0 0 0 0 1 -1\n1 first 0 10 0 0 0 0 0 1 -1\n2 second 0 20 0 0 0 0 0 1 -1\n3 absent 0 30 0 0 0 0 0 1 -1\nend'], 'scene.ipl');
test('scene assembly resolves multiple model types, groups repeats and reports omissions', async () => {
  const result = await readScene({ file, placementFile, associations, parents: [], interior: 0 });
  expect(result.scene.map(p => [p.name, p.placements.length, p.textures.length])).toEqual([['first', 2, 1], ['second', 1, 1]]);
  expect(result.scene[0].textures[0]).toBe(result.scene[1].textures[0]);
  expect(result.requested).toBe(4); expect(result.omitted).toBe(1); expect(result.notices.join(' ')).toContain('Missing model: absent.dff');
});
test('scene assembly rejects ambiguous IDs and empty interiors, and reports absent dictionaries', async () => {
  await expect(readScene({ file, placementFile, associations: [associations[0], { ...associations[1], id: 1 }], parents: [], interior: 0 })).rejects.toThrow('Ambiguous');
  await expect(readScene({ file, placementFile, associations, parents: [], interior: 4 })).rejects.toThrow('placements');
  const result = await readScene({ file, placementFile, associations: [], parents: [], interior: 0 });
  expect(result.scene[0].notices.join(' ')).toContain('Missing dictionary: first.txd');
  expect(result.scene[0].notices.join(' ')).toContain('Unbound textures');
});


test('scene metadata retains unfiltered source indices and classifies unavailable LOD targets', async () => {
  const placementFile=new File(['inst\n1 first 2 0 0 0 0 0 0 1 -1\n1 first 0 0 0 0 0 0 0 1 3\n2 second 0 10 0 0 0 0 0 1 0\n2 second 0 20 0 0 0 0 0 1 4\n3 absent 0 30 0 0 0 0 0 1 99\nend'],'lod.ipl');
  const result=await readScene({file,placementFile,associations:[{...associations[0],drawDistance:150,flags:0},associations[1]],parents:[],interior:0});
  expect(result.scene.map(p=>p.sourceIndices)).toEqual([[1],[2,3]]);
  expect(result.scene[0].definition?.drawDistance).toBe(150);
  expect(result.lodLinks).toMatchObject([{sourceIndex:1,targetIndex:3,status:'local'},{sourceIndex:2,targetIndex:0,status:'other-interior'},{sourceIndex:3,targetIndex:4,status:'missing-model'},{sourceIndex:4,targetIndex:99,status:'missing-placement'}]);
});
test('streamed binary LOD indices are not guessed to be local placements', async () => {
  const bytes=new Uint8Array(116),view=new DataView(bytes.buffer);bytes.set(new TextEncoder().encode('bnry'));view.setUint32(4,1,true);view.setUint32(28,76,true);view.setFloat32(100,1,true);view.setInt32(104,1,true);view.setInt32(112,0,true);
  const result=await readScene({file,placementFile:new File([bytes],'stream.ipl'),associations,parents:[],interior:0});
  expect(result.scene[0].sourceIndices).toEqual([0]);expect(result.scene[0].placementFormat).toBe('binary');
  expect(result.lodLinks).toMatchObject([{sourceIndex:0,targetIndex:0,status:'external-static-array'}]);
});

function streamedPlacement(modelId = 1) {
  const bytes=new Uint8Array(116),view=new DataView(bytes.buffer);bytes.set(new TextEncoder().encode('bnry'));view.setUint32(4,1,true);view.setUint32(28,76,true);view.setFloat32(76,10,true);view.setFloat32(100,1,true);view.setInt32(104,modelId,true);view.setInt32(112,0,true);
  return new File([bytes],'stream.ipl');
}
test('explicit static and streamed sources retain distinct identities within a shared model group', async () => {
  const staticPlacementFile=new File(['inst\n1 first 0 0 0 0 0 0 0 1 -1\nend'],'base.ipl');
  const result=await readScene({file,placementFile:streamedPlacement(),staticPlacementFile,associations,parents:[],interior:0});
  expect(result.requested).toBe(2);expect(result.scene).toHaveLength(1);
  expect(result.scene[0].sourceRefs?.map(r=>[r.namespace,r.index,r.sourceName,r.lodTarget])).toEqual([['static',0,'base.ipl',undefined],['primary',0,'stream.ipl',{namespace:'static',index:0}]]);
  expect(result.lodLinks).toEqual([{sourceIndex:0,targetIndex:0,sourceKey:'primary:0',targetKey:'static:0',status:'resolved-static'}]);
});
test('related source loading rejects incompatible formats and cyclic static LOD chains', async () => {
  const request={file,placementFile:streamedPlacement(),associations,parents:[] as [string,string][],interior:0};
  await expect(readScene({...request,staticPlacementFile:streamedPlacement()})).rejects.toThrow('text IPL');
  await expect(readScene({...request,placementFile,staticPlacementFile:placementFile})).rejects.toThrow('binary primary');
  const cyclic=new File(['inst\n1 first 0 0 0 0 0 0 0 1 1\n1 first 0 10 0 0 0 0 0 1 0\nend'],'cyclic.ipl');
  await expect(readScene({...request,staticPlacementFile:cyclic})).rejects.toThrow('Cyclic IPL LOD');
});
