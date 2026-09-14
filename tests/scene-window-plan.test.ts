import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {readDff} from '../src/assets/dff';
import {readCol} from '../src/assets/col';
import {catalogScenePlacements as catalog,planSceneWindow as plan} from '../src/assets/sceneWindowPlan';
import type {ScenePart} from '../src/assets/scene';
function part(source='a.ipl'):ScenePart{return {name:'diagnostic_col3',model:readDff(new Uint8Array(readFileSync('tests/fixtures/dragonff-model.dff'))),collision:readCol(new Uint8Array(readFileSync('tests/fixtures/dragonff-collision-v3.col')))[0],collisionSource:'diagnostic.col',textures:[],dictionaryNames:[],notices:[],placements:[{modelId:1,modelName:null,instanceType:0,interior:0,position:[0,0,0],rotation:[0,0,0,1],lodIndex:-1}],sourceRefs:[{namespace:'primary',index:0,format:'binary',sourceName:source}]};}
test('retains stable source placements despite district namespace and part-order changes',()=>{
 const a=part(),b=part('b.ipl');b.sourceRefs![0].namespace='district:1:primary';
 const before=catalog([a,b],'depot');a.sourceRefs![0].namespace='district:2:primary';b.sourceRefs![0].namespace='primary';
 const result=plan(before,catalog([b,a],'depot'));expect(result.retained).toHaveLength(2);expect(result.added).toHaveLength(0);expect(result.removed).toHaveLength(0);expect(result.replaced).toHaveLength(0);
 expect(result.retained.map(e=>e.part)).toEqual([0,1]);
});
test('same local index in different files/datasets is distinct, and changed transforms replace an entity',()=>{
 const a=part(),before=catalog([a],'depot');a.placements[0].position[0]=5;expect(plan(before,catalog([a],'depot')).replaced).toHaveLength(1);
 for(const after of [catalog([part('b.ipl')],'depot'),catalog([part()],'different-depot')]){const result=plan(before,after);expect(result.retained).toHaveLength(0);expect(result.added).toHaveLength(1);expect(result.removed).toHaveLength(1);}
});
test('resolves stable LOD identity and physical ownership across namespace changes',()=>{
 const child=part(),lod=part('static.ipl');lod.sourceRefs![0].namespace='static';lod.sourceRefs![0].format='text';child.placements[0].lodIndex=0;child.sourceRefs![0].lodTarget={namespace:'static',index:0};
 const before=catalog([child,lod],'depot');expect([...before.entries.values()].map(e=>e.physical)).toEqual([true,false]);
 child.sourceRefs![0].namespace='district:1:primary';lod.sourceRefs![0].namespace='district:1:static';child.sourceRefs![0].lodTarget.namespace='district:1:static';
 expect(plan(before,catalog([child,lod],'depot')).retained).toHaveLength(2);
 const partial=catalog([child],'depot');expect(partial.unresolvedLodTargets).toBe(1);expect(plan(partial,partial).retained).toHaveLength(0);expect(plan(partial,partial).replaced).toHaveLength(1);
});
test('rejects duplicate source identities and missing provenance',()=>{
 const a=part(),b=part('A.IPL');b.sourceRefs![0].namespace='district:1:primary';expect(()=>catalog([a,b],'depot')).toThrow('Duplicate source placement');
 a.sourceRefs=undefined;expect(()=>catalog([a],'depot')).toThrow('source references');expect(()=>catalog([],'')).toThrow('dataset');
});
test('replaces a shared placement when a newly loaded child changes its collision role',()=>{
 const child=part(),lod=part('static.ipl');lod.sourceRefs![0].namespace='static';lod.sourceRefs![0].format='text';
 const before=catalog([lod],'depot');expect([...before.entries.values()][0].physical).toBe(true);
 child.placements[0].lodIndex=0;child.sourceRefs![0].lodTarget={namespace:'static',index:0};
 const result=plan(before,catalog([child,lod],'depot'));
 expect(result.retained).toHaveLength(0);expect(result.added).toHaveLength(1);expect(result.replaced).toHaveLength(1);
 expect(result.replaced[0].previous.physical).toBe(true);expect(result.replaced[0].next.physical).toBe(false);
});
