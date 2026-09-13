import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { readCol } from '../src/assets/col';
import { readDff } from '../src/assets/dff';
import type { ScenePart } from '../src/assets/scene';
import { sceneVisibilityBounds } from '../src/assets/sceneBounds';
import { planSceneCollision } from '../src/assets/sceneCollision';
const col=()=>readCol(new Uint8Array(readFileSync('tests/fixtures/dragonff-collision-v3.col')))[0];
function part(name:string,index:number,lodIndex=-1):ScenePart {
  return {name,model:readDff(new Uint8Array(readFileSync('tests/fixtures/dragonff-model.dff'))),textures:[],dictionaryNames:[],notices:[],collision:undefined,collisionSource:undefined,placements:[{modelId:index,modelName:name,instanceType:0,interior:0,position:[0,0,0],rotation:[0,0,0,1],lodIndex}],sourceRefs:[{namespace:'primary',index,format:'text',sourceName:'test.ipl',lodTarget:lodIndex<0?undefined:{namespace:'primary',index:lodIndex}}]};
}
test('single-child LOD bounds share the detailed model data without adding physical collision', () => {
  const detail=part('detail',0,1),lod=part('lod',1);detail.collision=col();
  const result=sceneVisibilityBounds([detail,lod]);expect(result.bounds[1]).toEqual({bounds:detail.collision.bounds,sourceModel:'detail',inherited:true});expect(result.bounds[1]!.bounds).toBe(detail.collision.bounds);
  expect(lod.collision).toBeUndefined();expect(planSceneCollision([detail,lod]).missing).toEqual([]);
});
test('multi-child LOD keeps aggregate bounds while ambiguous repeated-model donors are reported', () => {
  const a=part('a',0,2),b=part('b',1,2),lod=part('lod',2);a.collision=col();b.collision=col();lod.collision=col();lod.collision.bounds.radius=50;
  expect(sceneVisibilityBounds([a,b,lod]).bounds[2]).toMatchObject({sourceModel:'lod',inherited:false,bounds:{radius:50}});
  b.placements[0].lodIndex=3;b.sourceRefs![0].lodTarget!.index=3;lod.placements.push({...lod.placements[0]});lod.sourceRefs!.push({...lod.sourceRefs![0],index:3});
  const result=sceneVisibilityBounds([a,b,lod]);expect(result.notices.join(' ')).toContain('Ambiguous');expect(result.bounds[2]?.bounds.radius).toBe(50);
});
test('missing donor collision does not fabricate a bound or mutate the target', () => {
  const result=sceneVisibilityBounds([part('detail',0,1),part('lod',1)]);expect(result.bounds).toEqual([undefined,undefined]);expect(result.notices.join(' ')).toContain('unavailable collision');
});
