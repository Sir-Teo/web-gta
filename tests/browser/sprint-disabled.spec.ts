import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** DISABLE_PLAYER_SPRINT (m_bPlayerSprintDisabled): PlayerControlZelda turns the sprint button into a run. */
test('with sprint disabled by the script, Shift runs instead of sprinting',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>{const s=(window as any).__game.state();return {grounded:s.player.grounded,action:s.nativeCharacter?.action,sprinting:s.nativeCharacter?.moves?.some((m:any)=>m.clip==='sprint'&&m.blend>.5)};});
 await expect.poll(async()=>(await state()).grounded,{timeout:60000}).toBe(true);
 await page.evaluate(()=>{(window as any).__game.missionForProfiling().runtime.game.playerInfo.sprintDisabled=true;});
 await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyW');
 let sprinted=false;for(let i=0;i<20;i++){const s=await state();if(s.sprinting||s.action==='sprint')sprinted=true;await page.waitForTimeout(100);}
 await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');
 expect(sprinted).toBe(false);
 expect(errors).toEqual([]);
});
