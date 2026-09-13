import {expect,test} from '@playwright/test';
test('visible sun follows native positions with independent imported core and corona colors',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/tests/fixtures/sun.html');await page.waitForFunction(()=>typeof(window as any).sunProbe==='function');
  const result=await page.evaluate(()=>(window as any).sunProbe());
  for(const time of ['noon','morning']){
    expect(result[time][0]).toBe(255);expect(result[time][1]).toBe(0);expect(result[time][2]).toBeGreaterThanOrEqual(54);expect(result[time][2]).toBeLessThanOrEqual(57);
  }
  expect(result.dawn).toEqual([255,0,0]);expect(result.midnight).toEqual([0,0,0]);expect(errors).toEqual([]);
  expect(result.fade.slice(0,3)).toEqual([0,18,36]);expect(result.fade.at(-1)).toBe(255);
  for(let i=1;i<result.fade.length;i++)expect(result.fade[i]).toBeGreaterThanOrEqual(result.fade[i-1]);
  expect(result.lookFade).toEqual([0,18,255]);
  expect(result.blocked).toEqual([255,0,0]);expect(result.unblocked[0]).toBe(255);expect(result.unblocked[1]).toBe(0);expect(result.unblocked[2]).toBeGreaterThanOrEqual(54);expect(result.unblocked[2]).toBeLessThanOrEqual(57);
  expect(result.indoorProcedural).toEqual([0,0,0]);expect(result.indoorTextured).toEqual([0,0,0]);expect(result.exteriorAgain).toEqual([128,0,128]);
  expect(result.textured).toEqual([128,0,128]);expect(result.zeroSize).toEqual([0,0,0]);expect(result.occluded).toEqual([0,0,0]);expect(result.restored).toEqual(result.unblocked);
});
