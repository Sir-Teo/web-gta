import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** Under the pause menu the world is held and does not move: after a few frames it is drawn again only when something
 * may change it (a tap in the menu, a setting) or every two seconds, not ten times a second, so a phone left paused
 * keeps its GPU idle; resumed, every frame draws again. */
test.use({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
test('a paused phone stops redrawing the held world, and draws again for a setting or on resuming',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 const frames=()=>page.evaluate(()=>(window as any).__game.state().frameProfile.frames as number);
 const drawnOver=async(ms:number)=>{const a=await frames();await page.waitForTimeout(ms);return (await frames())-a;};
 expect(await drawnOver(2000)).toBeGreaterThan(4);
 await page.locator('.touch-button.pause').dispatchEvent('pointerdown',{pointerType:'touch'});
 await page.waitForTimeout(1000);
 // Held: four seconds draw at most the two-second refreshes (and not the forty a ten-a-second menu would).
 expect(await drawnOver(4000)).toBeLessThanOrEqual(3);
 // A setting changed in the menu draws the world again, to show it.
 const before=await frames();
 await page.getByRole('button',{name:'Display',exact:true}).tap();
 await page.getByLabel('Resolution',{exact:true}).selectOption('low');
 await expect.poll(frames,{timeout:3000}).toBeGreaterThan(before);
 await page.getByLabel('Resolution',{exact:true}).selectOption('standard');
 // Resumed, every frame draws again.
 await page.getByRole('button',{name:'Resume game',exact:true}).tap();
 expect(await drawnOver(2000)).toBeGreaterThan(4);
 expect(errors).toEqual([]);
});
