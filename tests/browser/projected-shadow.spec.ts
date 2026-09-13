import {test,expect} from '@playwright/test';
test('projected inverse-color shadows darken baked terrain with native receiver lighting and depth occlusion',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/tests/fixtures/projected-shadow.html');await page.waitForFunction(()=>typeof (window as any).projectedShadowProbe==='function');
 const result=await page.evaluate(()=>(window as any).projectedShadowProbe());
 for(const [name,expected] of Object.entries({distanceFade:192,day:90,night:153,unlit:179,half:172,black:255,zero:255,missing:255})){
  result[name].center.slice(0,3).forEach((v:number)=>expect(Math.abs(v-expected),name).toBeLessThanOrEqual(1));
  expect(result[name].outside).toEqual([255,255,255,255]);expect(result[name].center[3]).toBe(255);
 }
 result.colored.center.slice(0,3).forEach((v:number,i:number)=>expect(Math.abs(v-[72,36,18][i])).toBeLessThanOrEqual(1));
 expect(result.occluded.center.slice(0,3)).toEqual([255,0,0]);expect(result.cleared).toBe(true);expect(errors).toEqual([]);
});
