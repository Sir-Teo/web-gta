import { expect, test } from '@playwright/test';
test('native GPU lighting adds prelight and honors surface coefficients and the LIGHT flag', async ({page}) => {
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/tests/fixtures/lighting.html');
  await page.waitForFunction(() => typeof (window as any).lightingProbe === 'function');
  const pixels=await page.evaluate(()=>(window as any).lightingProbe());
  for(const [key,value] of Object.entries({nightBlend:102,dark:0,deformedNormal:45,ambient:64,sun:64,prelit:51,additive:115,ambientCoefficient:128,diffuseCoefficient:128,clamped:255,modulated:128,inspection:51,unlit:51})) {
    for(const color of pixels[key].slice(0,3))expect(Math.abs(color-value),key).toBeLessThanOrEqual(2);
    expect(pixels[key][3]).toBe(255);
  }
  expect(errors).toEqual([]);
});
