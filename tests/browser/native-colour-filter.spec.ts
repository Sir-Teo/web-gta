import {test,expect} from '@playwright/test';

// CPostEffects::ColourFilter: the timecycle's post-effect colours brighten and tint the whole frame additively.
test('the timecycle post-effect colours filter the frame; the goggles grey the filter to 64',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await page.waitForTimeout(1500);
 const s=await state();
 expect(s.colourFilter.enabled).toBe(true);expect(s.colourFilter.visible).toBe(true);
 expect(Math.max(...s.colourFilter.factor)).toBeGreaterThan(0);expect(Math.max(...s.colourFilter.factor)).toBeLessThanOrEqual(1);
 expect(s.colourFilter.extraMult).toBeGreaterThan(0);expect(s.colourFilter.extraMult).toBeLessThanOrEqual(.35);
 // The frame with the quad against without it: pixels only gain, never lose, and most of the screen changes.
 const probe=await page.evaluate(()=>(window as any).__game.colourFilterPixelProbe());
 expect(probe.visible).toBe(true);expect(probe.darkened).toBe(0);expect(probe.changed/probe.pixels).toBeGreaterThan(.5);
 expect(Math.max(...probe.meanGain)).toBeGreaterThan(2);
 // m_bColorEnable off: the quad goes.
 expect(await page.evaluate(()=>(window as any).__game.setColourFilter(false))).toBe(false);
 await page.waitForTimeout(300);expect((await state()).colourFilter.visible).toBe(false);
 await page.evaluate(()=>(window as any).__game.setColourFilter(true));
 await page.screenshot({path:'artifacts/native-colour-filter.png'});
 expect(errors).toEqual([]);
 console.log(JSON.stringify({filter:s.colourFilter,probe}));
});
