import {test,expect} from '@playwright/test';
test('native perspective clip bias reaches GPU depth without changing the borrowed camera or view offsets',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/tests/fixtures/shadow-depth.html');const result=await page.evaluate(()=>(window as any).shadowDepthProbe());
 expect(Math.abs(result.biased-result.expectedBiased)).toBeLessThanOrEqual(3);expect(Math.abs(result.ordinary-result.expectedOrdinary)).toBeLessThanOrEqual(3);
 expect(Math.abs(result.biased-result.ordinary)).toBeGreaterThan(20);expect(result.repeated).toBe(result.biased);
 expect(result.cameraUnchanged).toBe(true);expect(result.xyUnchanged).toBe(true);expect(result.polygonOffset).toBe(false);expect(errors).toEqual([]);
});
