import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('the live world loads the native restart tables and starts in the playing state',async({page})=>{
 test.setTimeout(120000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 // The worker extracts ADD_HOSPITAL_RESTART and ADD_POLICE_RESTART from the packaged script.
 await expect.poll(async()=>(await state()).restartPoints.hospitals,{timeout:60000}).toBe(8);
 expect((await state()).restartPoints.police).toBe(7);
 // CGameLogic starts in GAMELOGIC_STATE_PLAYING with a live player. The screen is faded out by MAIN for INTRO, so the
 // overlay is looked at in free roam.
 expect((await state()).gameLogicState).toBe(0);
 await endStoryMission(page);
 await expect.poll(async()=>(await state()).fadeAlpha,{timeout:10000}).toBe(0);
 const live=await state();
 expect(live.gameLogicState).toBe(0);
 expect(live.player.health).toBeGreaterThan(0);
 expect(live.deathRemaining).toBe(0);
 expect(errors).toEqual([]);
});
