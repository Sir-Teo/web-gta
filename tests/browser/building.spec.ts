import { expect,test } from '@playwright/test';
test('building GPU base pass separates night RGB from wet alpha and preserves ambient/modulation order',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/tests/fixtures/building.html');await page.waitForFunction(()=>typeof(window as any).buildingProbe==='function');
  const result=await page.evaluate(()=>(window as any).buildingProbe());
  for(const [key,value] of Object.entries({clearAmbient:128,facingSunAmbient:77,blockedSunAmbient:128,day:51,night:153,midpoint:102,ambientAfterModulation:102,ambientCoefficient:64,single:51,dryAlpha:192,wetAlpha:64,halfWet:128,texturedAmbient:64,fade:64}))for(const channel of result[key].slice(0,3))expect(Math.abs(channel-value),key).toBeLessThanOrEqual(2);
  expect(result.materialDepth.slice(0,3)).toEqual([0,255,0]);
  expect(errors).toEqual([]);
});
