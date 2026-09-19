import {test,expect} from '@playwright/test';
// CTaskSimplePlayerOnFoot::PlayIdleAnimations: left untouched for 20 s, CJ plays a playidles.ifp clip (stretch, time,
// shldr or strleg); any input blends it out.
test('CJ plays an idle animation after 20 s untouched and stops on input',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await page.waitForTimeout(15000);
 expect(['stretch','time','shldr','strleg']).not.toContain((await state()).nativeCharacter?.reaction);
 await expect.poll(async()=>(await state()).nativeCharacter?.reaction,{timeout:12000}).toMatch(/^(stretch|time|shldr|strleg)$/);
 await page.waitForTimeout(1500);await page.screenshot({path:'artifacts/player-idle.png'});
 await page.keyboard.press('KeyQ');
 await expect.poll(async()=>(await state()).nativeCharacter?.reaction??'none',{timeout:3000}).not.toMatch(/^(stretch|time|shldr|strleg)$/);
 expect(errors).toEqual([]);
});
