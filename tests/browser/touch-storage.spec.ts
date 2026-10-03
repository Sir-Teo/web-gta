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
 await clear.scrollIntoViewIfNeeded();await clear.tap();await expect(clear).toHaveText(/Tap again to clear/);
 expect(await page.evaluate(()=>caches.has('web-gta-world-v1'))).toBe(true);
 await clear.tap();await expect(line).toContainText('Cleared.');await expect(clear).toHaveText('Clear downloaded data');
 expect(await page.evaluate(()=>caches.has('web-gta-world-v1'))).toBe(false);
 // Left alone, the question goes back to the button.
 await clear.tap();await expect(clear).toHaveText(/Tap again/);await expect(clear).toHaveText('Clear downloaded data',{timeout:8000});
 // The game plays on.
 await page.getByRole('button',{name:'Resume game',exact:true}).tap();
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().paused)).toBe(false);
 expect(errors).toEqual([]);
});
