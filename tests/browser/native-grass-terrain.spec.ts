import {test,expect} from '@playwright/test';
test('imported eastern Chiliad renders persistent grass on its native collision terrain',async({page})=>{
 const depot=process.env.GTA_CONTENT_DIR;test.skip(!depot,'Requires native world content.');test.setTimeout(90000);
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.goto('/tests/fixtures/native-grass-terrain.html');await page.getByLabel('Native content folder').setInputFiles(depot!);await page.waitForFunction(()=>!!(window as any).grassTerrainProbe);
 const result=await page.evaluate(()=>(window as any).grassTerrainProbe());
 expect(result.initial).toEqual({entities:36,cached:19,triangles:142});expect(result.grassChanges).toBeGreaterThan(100);expect(result.repeatChanges).toBe(0);expect(result.batches).toBeGreaterThan(0);expect(errors).toEqual([]);
 await page.locator('canvas').screenshot({path:'artifacts/native-chiliad-grass.png'});
 expect(await page.evaluate(()=>(window as any).disposeGrassTerrainProbe())).toEqual({entities:0,cached:0,triangles:0,children:0});
});
