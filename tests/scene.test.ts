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

test('scene assembly retains a registered timed counterpart even when it has no loaded placement', async () => {
  const {readIdeAssociations}=await import('../src/assets/ide');
  const pairedFile=new File([imgFixture([{name:'shop_dy.dff',bytes:model}]) as BlobPart],'timed.img');
  const result=await readScene({file:pairedFile,placementFile:new File(['inst\n1 shop_dy 0 0 0 0 0 0 0 1 -1\nend'],'day.ipl'),associations:readIdeAssociations('tobj\n1 shop_dy shared 200 0 6 18\n2 shop_nt shared 200 0 18 6\nend'),parents:[],interior:0});
  expect(result.scene[0].timeCounterpart).toBe('shop_nt');expect(result.omitted).toBe(0);
});

function collisionNamed(name: string) {
  const bytes = new Uint8Array(readFileSync('tests/fixtures/dragonff-collision-v2.col'));
  bytes.fill(0, 8, 30); bytes.set(new TextEncoder().encode(name), 8); return bytes;
}
test('district assembly combines archived and external collision collections with per-model provenance', async () => {
  const district = new File([imgFixture([{name:'first.dff',bytes:model},{name:'second.dff',bytes:model},{name:'west.col',bytes:collisionNamed('first')}]) as BlobPart], 'district.img');
  const result = await readScene({file:district,placementFile,associations,parents:[],interior:0,allArchiveCollisions:true,additionalCollisionFiles:[new File([collisionNamed('second') as BlobPart],'east.col')]});
  expect(result.scene.map(p=>[p.name,p.collision?.name,p.collisionSource])).toEqual([['first','first','district.img / west.col'],['second','second','east.col']]);
  expect(result.collisionSource).toBe('district.img / west.col; east.col');
  const {planSceneCollision}=await import('../src/assets/sceneCollision');
  expect(planSceneCollision(result.scene).missing).toEqual([]);
});
test('district collision loading rejects conflicting shapes and identifies malformed sources', async () => {
  const request={file,placementFile,associations,parents:[] as [string,string][],interior:0};
  await expect(readScene({...request,collisionFile:new File([collisionNamed('first') as BlobPart],'a.col'),additionalCollisionFiles:[new File([collisionNamed('FIRST') as BlobPart],'b.col')]})).rejects.toThrow('Ambiguous collision model FIRST: a.col and b.col');
  await expect(readScene({...request,additionalCollisionFiles:[new File(['invalid'],'bad-district.col')]})).rejects.toThrow('bad-district.col:');
  await expect(readScene({...request,additionalCollisionFiles:Array.from({length:257},()=>new File([],'empty.col'))})).rejects.toThrow('256 collision');
});

test('separate streamed IPLs preserve repeated indices and share the selected static LOD array', async () => {
  const first = streamedPlacement(1), second = new File([await streamedPlacement(2).arrayBuffer()], 'second-stream.ipl');
  const result = await readScene({file, placementFile:first, additionalPlacementFiles:[second], staticPlacementFile:new File(['inst\n1 first 0 0 0 0 0 0 0 1 -1\nend'],'base.ipl'), associations, parents:[], interior:0});
  expect(result.requested).toBe(3);
  expect(result.scene.flatMap(p=>p.sourceRefs!.map(r=>[r.namespace,r.index,r.lodTarget]))).toEqual([
    ['static',0,undefined],['primary',0,{namespace:'static',index:0}],['stream:1',0,{namespace:'static',index:0}],
  ]);
  expect(result.lodLinks.map(link=>[link.sourceKey,link.targetKey,link.status])).toEqual([['primary:0','static:0','resolved-static'],['stream:1:0','static:0','resolved-static']]);
  const {planSceneCollision}=await import('../src/assets/sceneCollision');
  const plan=planSceneCollision(result.scene);
  expect(plan.lodTargets).toBe(1);expect(plan.placements.map(p=>p.length)).toEqual([1,1]);
});
test('archived sibling streams resolve by their own original indices and reject duplicate selection', async () => {
  const stream = new Uint8Array(await streamedPlacement(2).arrayBuffer());
  const district=new File([imgFixture([{name:'first.dff',bytes:model},{name:'second.dff',bytes:model},{name:'sibling.ipl',bytes:stream}]) as BlobPart],'district.img');
  const {readImgIndex}=await import('../src/assets/img');const entries=await readImgIndex(district);
  const request={file:district,placementFile:streamedPlacement(),additionalPlacementEntries:[entries[2]],associations,parents:[] as [string,string][],interior:0};
  const result=await readScene(request);
  expect(result.scene[1].sourceRefs?.[0]).toMatchObject({namespace:'stream:1',index:0,sourceName:'district.img / sibling.ipl'});
  expect(result.lodLinks.every(link=>link.status==='external-static-array')).toBe(true);
  await expect(readScene({...request,additionalPlacementEntries:[entries[2],entries[2]]})).rejects.toThrow('Duplicate streamed IPL');
  await expect(readScene({...request,placementFile})).rejects.toThrow('binary primary IPL');
  await expect(readScene({...request,additionalPlacementFiles:[new File(['inst\nend'],'wrong.ipl')]})).rejects.toThrow('wrong.ipl: additional streamed IPL must be binary');
});

test('external scene dictionaries bind missing bases, share decoded pixels and override archive names', async () => {
  const {txdFixture,textureFixture}=await import('./fixtures/native-assets');
  const replacement=txdFixture(textureFixture({name:'calibration_grid',width:8,height:8}));
  const result=await readScene({file,placementFile,associations,parents:[],interior:0,textureFiles:[new File([replacement as BlobPart],'SHARED.TXD')]});
  expect(result.scene[0].textures[0].mips[0].width).toBe(8);
  expect(result.scene[0].textures[0]).toBe(result.scene[1].textures[0]);
  const missing=await readScene({file,placementFile,associations:associations.map(a=>({...a,dictionary:'external'})),parents:[],interior:0,textureFiles:[new File([replacement as BlobPart],'external.txd')]});
  expect(missing.scene[0].textures[0].mips[0].width).toBe(8);
  expect(missing.scene[0].notices.join(' ')).not.toContain('Missing dictionary');
});
test('external parent dictionaries fill absent child textures without mixing unrelated dictionaries', async () => {
  const {txdFixture,textureFixture}=await import('./fixtures/native-assets');
  const child=txdFixture(textureFixture({name:'other',width:4,height:4}));
  const parent=txdFixture(textureFixture({name:'calibration_grid',width:8,height:8}));
  const result=await readScene({file,placementFile,associations,parents:[['shared','parent']],interior:0,textureFiles:[new File([child as BlobPart],'shared.txd'),new File([parent as BlobPart],'parent.txd')]});
  expect(result.scene[0].dictionaryNames).toEqual(['shared.txd','parent.txd']);
  expect(result.scene[0].textures[0].mips[0].width).toBe(8);
  expect(result.scene[0].textures[0]).toBe(result.scene[1].textures[0]);
  await expect(readScene({file,placementFile,associations,parents:[],interior:0,textureFiles:[new File([],'shared.txd'),new File([],'SHARED.TXD')]})).rejects.toThrow('Ambiguous external dictionary');
});

test('scene area filtering keeps distant LOD ancestors and original indices', async () => {
  const placements=new File(['inst\n1 first 0 1000 0 0 0 0 0 1 -1\n2 second 0 0 0 0 0 0 0 1 0\n2 second 0 500 0 0 0 0 0 1 -1\nend'],'region.ipl');
  const result=await readScene({file,placementFile:placements,associations,parents:[],interior:0,region:{x:0,y:0,radius:10}});
  expect(result.requested).toBe(2);expect(result.scene.map(p=>p.sourceIndices)).toEqual([[0],[1]]);
  expect(result.lodLinks).toMatchObject([{sourceKey:'primary:1',targetKey:'primary:0',status:'local'}]);
  await expect(readScene({file,placementFile:placements,associations,parents:[],interior:0,region:{x:0,y:0,radius:NaN}})).rejects.toThrow('Invalid scene region');
});

test('neighboring districts keep index zero attached to their own static LOD arrays',async()=>{
 const firstStatic=new File(['inst\n1 first 0 0 0 0 0 0 0 1 -1\nend'],'first-base.ipl');
 const secondStatic=new File(['inst\n2 second 0 20 0 0 0 0 0 1 -1\nend'],'second-base.ipl');
 const secondStream=new File([await streamedPlacement(1).arrayBuffer()],'neighbor-stream.ipl');
 const request={file,placementFile:streamedPlacement(2),staticPlacementFile:firstStatic,associations,parents:[] as [string,string][],interior:0};
 const result=await readScene({...request,additionalDistricts:[{file,placementFile:secondStream,staticPlacementFile:secondStatic}]});
 expect(result.requested).toBe(4);
 expect(result.lodLinks.map(l=>[l.sourceKey,l.targetKey,l.status])).toEqual([['primary:0','static:0','resolved-static'],['district:1:primary:0','district:1:static:0','resolved-static']]);
 expect(result.scene.find(p=>p.name==='first')!.sourceRefs?.map(r=>r.namespace)).toEqual(['static','district:1:primary']);
 expect(result.scene.find(p=>p.name==='second')!.sourceRefs?.map(r=>r.namespace)).toEqual(['primary','district:1:static']);
 await expect(readScene({...request,additionalDistricts:[{file,placementFile:secondStream}]})).rejects.toThrow('own static IPL');
 await expect(readScene({...request,additionalDistricts:[{file,placementFile:secondStream,staticPlacementFile:firstStatic}]})).rejects.toThrow('Duplicate district');
});

test('district namespaces reject nesting, oversized groups and ambiguous identifier spellings',async()=>{
 const {validPlacementNamespace}=await import('../src/assets/scenePlacements');
 expect(validPlacementNamespace('district:15:stream:255')).toBe(true);
 for(const value of ['district:16:static','district:01:primary','district:1:district:1:static','district:1:stream:256'])expect(validPlacementNamespace(value)).toBe(false);
 const group={file,placementFile};
 await expect(readScene({...group,associations,parents:[],interior:0,additionalDistricts:Array(16).fill(group)})).rejects.toThrow('at most 15');
 await expect(readScene({...group,associations,parents:[],interior:0,additionalDistricts:[{...group,additionalDistricts:[group]}]})).rejects.toThrow('non-nested');
});

test('scene metadata retains regional modifiers from both districts without altering model placements',async()=>{
 const row='0 0 0 100 100 100 800 0 75 10 .9';
 const first=new File(['inst\n1 first 0 0 0 0 0 0 0 1 -1\nend\ntcyc\n'+row+'\nend'],'first.ipl');
 const second=new File(['inst\n2 second 0 20 0 0 0 0 0 1 -1\nend\ntcyc\n'+row+'\nend'],'second.ipl');
 const result=await readScene({file,placementFile:first,additionalDistricts:[{file,placementFile:second}],associations,parents:[],interior:0});
 expect(result.requested).toBe(2);expect(result.omitted).toBe(0);
 expect(result.timecycleBoxes.map(b=>[b.sourceName,b.namespace,b.line,b.farClip])).toEqual([['first.ipl','primary',5,800],['second.ipl','district:1:primary',5,800]]);
 expect(result.notices).toContain('2 regional timecycle modifiers retained; playable color, fog and regional low-LOD scaling require a local timecycle table.');
});
