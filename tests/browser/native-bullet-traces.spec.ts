import {test,expect} from '@playwright/test';
// CBulletTraces: an M4 burst leaves short pale streaks along the bullets' lines that fade within 300 ms.
test('gunfire leaves fading bullet traces',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await page.keyboard.press('Tab');await page.locator('[data-weapon="31"]').click();await expect.poll(async()=>(await state()).weapons.ready).toBe(true);
 await page.evaluate(()=>(window as any).__game.turnPlayer(Math.PI));await page.waitForTimeout(300);
 const p=(await state()).player.position;
 let peak=0;
 for(let i=0;i<6;i++){
  await page.evaluate(({x,y,z})=>(window as any).__game.fireAt(x,y,z),{x:p.x,y:p.y+1.3,z:p.z-40});
  await page.waitForTimeout(60);peak=Math.max(peak,(await state()).bulletTraces);
 }
 expect(peak).toBeGreaterThan(0);
 await page.screenshot({path:'artifacts/native-bullet-traces.png'});
 // All gone once the longest life (300 ms) has passed.
 await expect.poll(async()=>(await state()).bulletTraces,{timeout:3000}).toBe(0);
 expect(errors).toEqual([]);
});
