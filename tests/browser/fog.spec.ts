import {expect,test} from '@playwright/test';
test('native fog interpolates linearly for ordinary and building shaders while exponential fallback remains intact',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/tests/fixtures/fog.html');await page.waitForFunction(()=>typeof(window as any).fogProbe==='function');
  const result=await page.evaluate(()=>(window as any).fogProbe());
  for(const key of ['ordinary','native'])for(const [i,red] of [255,255,191,128,64,0,0].entries()){
    expect(Math.abs(result[key][i][0]-red)).toBeLessThanOrEqual(1);expect(result[key][i][1]).toBe(0);expect(Math.abs(result[key][i][2]-(255-red))).toBeLessThanOrEqual(1);
  }
  for(const [i,depth] of [5,10,15,20,25,30,35].entries())expect(Math.abs(result.exponential[i][0]-255*Math.exp(-.05*.05*depth*depth))).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
