import {expect,test} from '@playwright/test';
test('textured sun preserves raster row orientation and the documented provisional extent mapping',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/tests/fixtures/sun-raster.html');await page.waitForFunction(()=>typeof(window as any).sunRasterProbe==='function');
  const results=await page.evaluate(()=>(window as any).sunRasterProbe());
  for(const {width,height,depth,fov,bounds,corners} of results){
    expect(corners).toEqual([[255,0,0],[0,255,0],[0,0,255],[255,255,0]]);
    expect(Math.abs(bounds.right-bounds.left+1-2*width*10*2.7335/depth*70/fov)).toBeLessThanOrEqual(1);
    expect(Math.abs(bounds.top-bounds.bottom+1-2*height*10*2.7335/depth*70/fov)).toBeLessThanOrEqual(1);
    expect(Math.abs((bounds.left+bounds.right+1)/2-width/2)).toBeLessThanOrEqual(.5);
    expect(Math.abs((bounds.top+bounds.bottom+1)/2-height/2)).toBeLessThanOrEqual(.5);
  }
  expect(errors).toEqual([]);
});
