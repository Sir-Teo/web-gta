import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CHud's other big-message styles: the script's queue hands the front of each style over every frame. The mission title
 * (STYLE_BOTTOM_RIGHT) runs its own clock past its queue time, then fades and goes; the odd-job title
 * (STYLE_MIDDLE_SMALLER_HIGHER) shows while queued, and gives way to a mission title. */
test('the mission title and the odd-job styles draw from the script’s big-message queues',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 // USJ in the odd-job title's style, while it is queued.
 await page.evaluate(()=>{const g=(window as any).__game,r=g.missionForProfiling().runtime;r.game.messages.addBigMessage2('USJ',60000,4,true,g.gameTimeMs());});
 const oddJob=page.locator('.oddjob-title');
 await expect(oddJob).toBeVisible({timeout:10000});await expect(oddJob).toHaveText(/stunt/i);
 // A mission title, queued for a moment only, holds its own time and takes the odd-job title's place.
 await page.evaluate(()=>{const g=(window as any).__game,r=g.missionForProfiling().runtime;r.game.messages.addBigMessage2('SKIP',100,1,true,g.gameTimeMs());});
 const title=page.locator('.mission-title');
 await expect(title).toBeVisible({timeout:10000});await expect(oddJob).toBeHidden();
 expect((await title.textContent())?.length).toBeGreaterThan(0);
 const box=await title.boundingBox(),view=page.viewportSize()!;
 expect(box!.x+box!.width).toBeGreaterThan(view.width*.8);expect(box!.y).toBeGreaterThan(view.height*.5);
 await expect(title).toBeHidden({timeout:60000});
 await expect(oddJob).toBeVisible();
 expect(errors).toEqual([]);
});
