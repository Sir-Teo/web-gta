import {test,expect} from '@playwright/test';
// CMotionBlurStreaks: a thrown grenade trails a grey ribbon while it flies.
test('a thrown grenade trails a motion blur streak',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await page.keyboard.press('Tab');await page.locator('[data-weapon="16"]').click();await expect.poll(async()=>(await state()).weapons.ready).toBe(true);
 await page.evaluate(()=>(window as any).__game.turnPlayer(Math.PI));await page.waitForTimeout(300);
 const p=(await state()).player.position;
  expect(await page.evaluate(({x,y,z})=>(window as any).__game.fireAt(x,y,z),{x:p.x,y:p.y+6,z:p.z-25})).toBe(true);
 let peak=0;for(let i=0;i<30&&peak===0;i++){await page.waitForTimeout(50);peak=Math.max(peak,(await state()).streaks);}
 expect(peak).toBeGreaterThan(0);
 await page.screenshot({path:'artifacts/native-motion-blur-streaks.png'});
 expect(errors).toEqual([]);
});
