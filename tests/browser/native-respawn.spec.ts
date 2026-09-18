import {test,expect} from '@playwright/test';

test('the live world loads the native restart tables and starts in the playing state',async({page})=>{
 test.setTimeout(120000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 // The worker extracts ADD_HOSPITAL_RESTART and ADD_POLICE_RESTART from the packaged script.
 await expect.poll(async()=>(await state()).restartPoints.hospitals,{timeout:60000}).toBe(8);
 expect((await state()).restartPoints.police).toBe(7);
 const live=await state();
 // CGameLogic starts in GAMELOGIC_STATE_PLAYING with no fade overlay and a live player.
 expect(live.gameLogicState).toBe(0);
 expect(live.fadeAlpha).toBe(0);
 expect(live.player.health).toBeGreaterThan(0);
 expect(live.deathRemaining).toBe(0);
 expect(errors).toEqual([]);
});
