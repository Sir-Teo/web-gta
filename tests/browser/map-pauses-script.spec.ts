import {test,expect} from '@playwright/test';
/** The full map holds the game, and the script with it, as the original's frontend map does: the script's time must not
 * run on while the world stands still. */
test('the script stands still while the full map is open',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true&&(window as any).__game.missionForProfiling()?.snapshot()?.started,undefined,{timeout:90000});
 const scriptMs=()=>page.evaluate(()=>(window as any).__game.missionForProfiling().elapsed as number);
 await page.keyboard.press('KeyM');await expect(page.locator('.world-map-panel')).toBeVisible();
 // A frame may still step between the key and the map opening.
 await page.waitForTimeout(300);const opened=await scriptMs();
 await page.waitForTimeout(1500);
 expect(await scriptMs()-opened).toBe(0);
 await page.keyboard.press('KeyM');
 await expect.poll(async()=>await scriptMs()-opened,{timeout:20000}).toBeGreaterThan(0);
 expect(errors).toEqual([]);
});
