import {test,expect} from '@playwright/test';
// CPlaneTrails: the three distant sky planes lay contrails, a point every 2 s.
test('distant planes leave contrails in a clear sky',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await page.evaluate(()=>(window as any).__game.setTime(12*60));
 // Two points make a segment: one trail per plane after 2 s.
 await expect.poll(async()=>(await state()).planeTrails,{timeout:15000}).toBeGreaterThanOrEqual(3);
 expect(errors).toEqual([]);
});
