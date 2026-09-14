import {test,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
test('native grass preserves alpha and repeated UV sampling with stable placement and wind',async({page})=>{
 const depot=process.env.GTA_CONTENT_DIR;test.skip(!depot,'Requires native grass content.');
 const names=['plant1.txd',...Array.from({length:2},(_,table)=>Array.from({length:4},(_,i)=>`grass${table}_${i+1}.dff`)).flat()];
 const input=Object.fromEntries(await Promise.all(names.map(async name=>[name,[...await readFile(join(depot!,'models/grass',name))]])));
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.goto('/tests/fixtures/native-grass.html');await page.waitForFunction(()=>!!(window as any).grassProbe);
 const alpha=await page.evaluate(input=>(window as any).grassAlphaProbe(input),input);
 await writeFile('/tmp/web-gta-grass-alpha-audit.json',JSON.stringify(alpha,null,2));expect(alpha).toHaveLength(36);
 expect(alpha.filter((row:any)=>row.layout==='native-wrap-range')).toHaveLength(18);
 for(const row of alpha){expect(row.zero).toBeGreaterThan(0);expect(row.partial).toBeGreaterThan(0);expect(row.opaque).toBeGreaterThan(0);expect(row.transparentChanges,row.name).toBe(0);expect(row.maxError,row.name).toBeLessThanOrEqual(2);}
 expect(alpha.find((row:any)=>row.name==='txgrass0_0').zero).toBe(2753);
 const result=await page.evaluate(input=>(window as any).grassProbe(input),input);
 expect(result.repeatUploads).toBe(0);expect(result.windUploads).toBeGreaterThan(0);
 expect(result.lit).toBeGreaterThan(1000);expect(result.repeatChanges).toBe(0);expect(result.windChanges).toBeGreaterThan(100);expect(result.calmChanges).toBeGreaterThan(100);expect(result.hiddenLit).toBe(0);expect(result.sampled).toBe(result.drawCount);expect(errors).toEqual([]);
 await page.locator('canvas').screenshot({path:'artifacts/native-grass-pass.png'});
 await page.evaluate(()=>(window as any).disposeGrassProbe());
});
