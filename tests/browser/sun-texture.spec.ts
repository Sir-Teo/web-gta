import {expect,test} from '@playwright/test';
test('local sun texture worker replaces GPU pixels, retains a good raster on failure and releases canceled work',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/tests/fixtures/sun-texture.html');await page.waitForFunction(()=>typeof(window as any).sunTextureProbe==='function');
  const result=await page.evaluate(()=>(window as any).sunTextureProbe());
  expect(result.red).toEqual([255,0,0,255]);expect(result.blue).toEqual([0,0,255,255]);expect(result.afterError).toEqual(result.red);
  expect(result.retained).toBe(true);expect(result.error).not.toBe('');expect(result.allocated).toBe(1);expect(result.released).toBe(0);expect(result.cancellation).toBe(false);expect(errors).toEqual([]);
});
