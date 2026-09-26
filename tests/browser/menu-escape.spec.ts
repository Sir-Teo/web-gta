import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** Escape pauses, and from the pause menu it resumes, as the original's does, even after a menu button was clicked and
 * kept the focus. */
test('Escape leaves the pause menu, also once one of its buttons has the focus',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await endStoryMission(page);
 const paused=()=>page.evaluate(()=>(window as any).__game.state().paused as boolean);
 await page.locator('canvas.world').click({position:{x:400,y:300}});
 await page.keyboard.press('Escape');await expect.poll(paused).toBe(true);
 await page.getByRole('button',{name:'Controls',exact:true}).click();
 await page.keyboard.press('Escape');await expect.poll(paused).toBe(false);
 await page.keyboard.press('Escape');await expect.poll(paused).toBe(true);
 expect(errors).toEqual([]);
});
