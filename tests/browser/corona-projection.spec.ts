import {expect,test} from '@playwright/test';
test('corona camera adapter locates rendered surfaces with camera transforms and off-axis projection',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/tests/fixtures/corona-projection.html');await page.waitForFunction(()=>typeof(window as any).coronaProjectionProbe==='function');
  const pixels=await page.evaluate(()=>(window as any).coronaProjectionProbe());
  expect(pixels).toHaveLength(6);for(const pixel of pixels)expect(pixel).toEqual([255,0,0,255]);expect(errors).toEqual([]);
});
