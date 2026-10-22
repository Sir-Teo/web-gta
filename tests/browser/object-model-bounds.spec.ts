import {test,expect} from '@playwright/test';

test('a separately loaded native object model exposes its COL dimensions to later script queries',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const paths=['/src/simulation/ScriptObjectViews.ts','/src/assets/staticWorldArchive.ts','/src/assets/ide.ts','/tests/fixtures/native-render-dependencies.ts'];
  const [{ScriptObjectViews},{openStaticWorld},{readIdeAssociations},{THREE}]=await Promise.all(paths.map(p=>import(/* @vite-ignore */ p))),base=new URL('/play/world/',location.href).href,source=await openStaticWorld(base),resource=source.manifest.resources.find((r:any)=>r.path==='ide/generic/dynamic.ide'),definitions=readIdeAssociations(await(await source.resource(resource)).text()),views=new ScriptObjectViews(new THREE.Scene(),base,definitions);
  try{const part=await views.sceneModelPart(1230);if(!part?.collision)throw Error('Native cardboardbox COL missing');const b=part.collision.bounds,expected={min:{x:b.min[0],y:b.min[1],z:b.min[2]},max:{x:b.max[0],y:b.max[1],z:b.max[2]}};return {expected,byId:views.modelBounds(1230)??null,byName:views.modelBounds('CARDBOARDBOX')??null};}finally{views.dispose();}
 });
 expect(result.byId).toEqual(result.expected);expect(result.byName).toEqual(result.expected);expect(result.expected.max.z).toBeGreaterThan(result.expected.min.z);
});
