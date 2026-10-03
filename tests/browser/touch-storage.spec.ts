import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** The pause menu's Controls page says how much San Andreas keeps on the device and clears it on a second tap: the
 * world's chunks and the offline data go, and the game plays on. */
test.use({viewport:{width:844,height:390},hasTouch:true,isMobile:true});
test('the Controls page shows the downloaded data and clears it on a second tap',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 // The first window's chunks are kept as they arrive.
 await expect.poll(()=>page.evaluate(async()=>(await (await caches.open('web-gta-world-v1')).keys()).length),{timeout:30000}).toBeGreaterThan(0);
 await page.locator('.touch-button.pause').dispatchEvent('pointerdown',{pointerType:'touch'});
 await page.getByRole('button',{name:'Controls',exact:true}).tap();
 const line=page.locator('.storage-settings small'),clear=page.getByRole('button',{name:/clear/i});
 await expect(line).toContainText(/MB kept on this device for quick starts and offline play/);
 // One tap asks; a second clears.
 const kept=()=>page.evaluate(async()=>await caches.has('web-gta-world-v1')?(await (await caches.open('web-gta-world-v1')).keys()).length:0);
 await clear.scrollIntoViewIfNeeded();await clear.tap();await expect(clear).toHaveText(/Tap again to clear/);
 const before=await kept();expect(before).toBeGreaterThan(20);
 // The chunks kept go. A read already on its way when the tap came (a ped's model; a phone keeps few chunks decoded,
 // so it goes back to the network) may keep its chunk again: what the game needs where it is, not what was kept.
 await clear.tap();await expect(line).toContainText('Cleared.');await expect(clear).toHaveText('Clear downloaded data');
 expect(await kept()).toBeLessThan(Math.min(10,before/4));
 // Left alone, the question goes back to the button.
 await clear.tap();await expect(clear).toHaveText(/Tap again/);await expect(clear).toHaveText('Clear downloaded data',{timeout:8000});
 // The game plays on.
 await page.getByRole('button',{name:'Resume game',exact:true}).tap();
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().paused)).toBe(false);
 expect(errors).toEqual([]);
});
