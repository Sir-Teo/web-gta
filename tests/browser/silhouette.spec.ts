import {test,expect} from '@playwright/test';
test('silhouette follows GPU skinning, excludes siblings, and restores borrowed rendering state even on failure',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/tests/fixtures/silhouette.html');await page.waitForFunction(()=>typeof (window as any).silhouetteProbe==='function');
 const r=await page.evaluate(()=>(window as any).silhouetteProbe());
 expect(r.initial.pixels).toBe(512);expect(r.moved.pixels).toBe(512);expect(r.moved.center-r.initial.center).toBeCloseTo(32,6);expect(r.initial.center).toBeCloseTo(47.5,6);
 expect(r.hidden.pixels).toBe(0);expect(r.after).toEqual(r.before);expect(r.failed).toBe(true);expect(r.restored).toEqual(r.before);expect(r.recovered).toEqual(r.moved);expect(errors).toEqual([]);
});
