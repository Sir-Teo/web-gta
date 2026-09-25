import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CStats::DisplayScriptStatUpdateMessage: a stat rising by more than 1 shows its GXT name, "+" and a bar. */
test('a stamina rise shows the stat box with its GXT name',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await page.waitForFunction(()=>(window as any).__game?.missionForProfiling()?.snapshot()?.started===true,undefined,{timeout:90000});
 await endStoryMission(page);
 // Let the GXT load, then raise stamina by 5 as UpdateStatsWhenRunning's AR_STATS row would.
 await page.waitForTimeout(3000);
 // A stat box the opening script raised holds CHud's help slot (HelpMessageDisplayed) until it closes.
 await expect(page.locator('.stat-update')).toBeHidden({timeout:15000});
 await page.evaluate(()=>{const game=(window as any).__game.missionForProfiling().runtime.game;game.stats.increment(22,5);game.stats.onUpdateMessage(true,22,5);});
 const box=page.locator('.stat-update');
 await expect(box).toBeVisible();await expect(box.locator('.stat-name')).toHaveText('Stamina');await expect(box.locator('.stat-sign')).toHaveText('+');
 await page.screenshot({path:'test-results/stat-update.png'});
 await expect(box).toBeHidden({timeout:6000});
 expect(errors).toEqual([]);
});
