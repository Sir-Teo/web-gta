import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** The arsenal and the map keep the keyboard while open: Tab walks their controls and wraps round instead of closing
 * them, Escape closes the arsenal and M the map, and the game has the keyboard back once they are closed. */
test('Tab stays inside the open arsenal and map',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 const focused=()=>page.evaluate(()=>{const a=document.activeElement as HTMLElement;return a.getAttribute('aria-label')??a.className??a.tagName;});
 await page.locator('canvas.world').click({position:{x:400,y:300}});
 await page.keyboard.press('Tab');await expect.poll(async()=>(await state()).weapons.arsenal).toBe(true);
 expect(await focused()).toBe('Find a weapon');
 const stops=await page.locator('.arsenal button:visible, .arsenal input:visible').count();
 for(let i=0;i<stops;i++)await page.keyboard.press('Tab');
 expect((await state()).weapons.arsenal).toBe(true);expect(await focused()).toBe('Find a weapon');
 await page.keyboard.press('Shift+Tab');expect(await page.evaluate(()=>!!document.activeElement?.closest('.arsenal'))).toBe(true);
 await page.keyboard.press('Escape');await expect.poll(async()=>(await state()).weapons.arsenal).toBe(false);
 expect((await state()).paused).toBe(false);expect(await page.evaluate(()=>document.activeElement?.matches('canvas.world'))).toBe(true);
 // The map: M opens it with the panel focused, Tab reaches the destination list first and wraps from Close.
 const mapOpen=()=>page.evaluate(()=>!(document.querySelector('.world-map-panel') as HTMLElement).hidden);
 await page.keyboard.press('KeyM');await expect.poll(mapOpen).toBe(true);
 expect(await focused()).toBe('San Andreas map');
 await page.keyboard.press('Tab');expect(await focused()).toBe('Map destination');
 for(let i=0;i<4;i++)await page.keyboard.press('Tab');
 expect(await page.evaluate(()=>(document.activeElement as HTMLElement).textContent)).toBe('Close [M]');
 await page.keyboard.press('Tab');expect(await focused()).toBe('Map destination');
 await page.keyboard.press('Shift+Tab');expect(await page.evaluate(()=>(document.activeElement as HTMLElement).textContent)).toBe('Close [M]');
 await page.keyboard.press('KeyM');await expect.poll(mapOpen).toBe(false);
 expect(await page.evaluate(()=>document.activeElement?.matches('canvas.world'))).toBe(true);
 // And M from the game opens it again.
 await page.keyboard.press('KeyM');await expect.poll(mapOpen).toBe(true);await page.keyboard.press('KeyM');await expect.poll(mapOpen).toBe(false);
 expect(errors).toEqual([]);
});
