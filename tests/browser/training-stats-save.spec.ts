import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('earned stamina and lung capacity survive ordinary pagehide/reload and initialize breath and HUD',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const rows:any[]=[];
 const play=()=>page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const read=()=>page.evaluate(()=>{const g=(window as any).__game,s=g.missionForProfiling().runtime.game.stats;return {stamina:s.get(22),lung:s.get(225),capacity:g.sim.playerLungCapacity(),breath:g.sim.player.breath};});
 await page.goto('/');await play();await endStoryMission(page);rows.push({mode:'initial',...await read()});expect(rows[0]).toMatchObject({stamina:100,lung:0,capacity:1150});
 // Actual CStats increments are the common path used by natural training and SCM commands.
 await page.evaluate(()=>{const g=(window as any).__game,s=g.missionForProfiling().runtime.game.stats;s.increment(22,50);s.increment(225,50);g.sim.player.breath=4;});
 rows.push({mode:'earned before reload',...await read()});expect(rows[1]).toMatchObject({stamina:150,lung:50,capacity:1300});
 // pagehide invokes the game's ordinary save hook; do not write a synthetic save or call a debug save helper.
 await page.reload();
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('web-gta.progress.v1')??'null'));rows.push({mode:'stored',trainingStats:stored?.trainingStats});expect(stored?.trainingStats).toEqual({stamina:150,lungCapacity:50});
 await play();await endStoryMission(page);
 const restored=await read();rows.push({mode:'restored',...restored});expect(restored).toEqual({stamina:150,lung:50,capacity:1300,breath:1300});
 const bar=page.locator('.breath-bar');await expect(bar).toHaveAttribute('aria-valuemax','1300');await expect(bar).toBeHidden();
 await page.screenshot({path:'artifacts/training-stats-save.png'});writeFileSync('artifacts/training-stats-save.json',JSON.stringify({rows,errors},null,2));expect(errors).toEqual([]);
});
