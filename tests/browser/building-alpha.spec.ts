import {expect,test} from '@playwright/test';
test('building dual alpha draws blend once and write depth only for their selected alpha range',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/tests/fixtures/building-alpha.html');await page.waitForFunction(()=>typeof(window as any).buildingAlphaProbe==='function');
  const result=await page.evaluate(()=>(window as any).buildingAlphaProbe());
  const red=[255,0,0],green=[0,255,0],blue=[0,0,255],half=[0,128,127],below=[0,127,128];
  const expected={normal:[red,red,half,green],zero:[blue,below,half,green],max:[red,red,red,green],disabled:[red,below,half,green],noDepth:[red,red,red,red],fade:[red,red,red,half],additive:[red,red,red,[0,128,255]],back:[green,half,red,red],restored:[red,red,half,green],recovered:[red,red,half,green]};
  function pixels(actual:number[][],expected:number[][]){actual.forEach((pixel,i)=>pixel.forEach((value,j)=>expect(Math.abs(value-expected[i][j]),JSON.stringify(result)).toBeLessThanOrEqual(2)));}
  pixels(result.blendOnce,[blue,below,half,green]);
  for(const [name,colors] of Object.entries(expected)){pixels(result[name].pixels,colors);expect(result[name].draws,name).toBe(name==='disabled'||name==='noDepth'?2:3);}
  expect(errors).toEqual([]);
});
