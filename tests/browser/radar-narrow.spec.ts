import {test,expect} from '@playwright/test';
/** CRadar's disc sits 87/640 across and 66/448 up; at 4:3 and wider it is 84/448 of the height across, and on a
 * screen narrower than 4:3 it is sized by the width, so it stays whole on a phone held upright. */
test('the radar keeps its place on a wide screen and stays on a narrow one',async({page})=>{
 test.setTimeout(120000);
 const box=async(width:number,height:number)=>{await page.setViewportSize({width,height});return page.evaluate(()=>{const r=document.querySelector('.minimap-button')!.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};});};
 await page.goto('/');await page.waitForSelector('.minimap-button',{state:'attached'});
 const wide=await box(1280,720);
 expect(wide.width).toBeCloseTo(84/448*720,1);expect(wide.height).toBeCloseTo(wide.width,1);
 expect((wide.left+wide.right)/2).toBeCloseTo(87/640*1280,1);expect(720-(wide.top+wide.bottom)/2).toBeCloseTo(66/448*720,1);
 const phone=await box(390,844);
 expect(phone.left).toBeGreaterThanOrEqual(0);expect(phone.width).toBeCloseTo(84/640*390,1);expect(phone.height).toBeCloseTo(phone.width,1);
 expect((phone.left+phone.right)/2).toBeCloseTo(87/640*390,1);expect(844-(phone.top+phone.bottom)/2).toBeCloseTo(66/448*844,1);
});
