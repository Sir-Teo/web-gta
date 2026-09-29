import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('at one star a cop clubs unarmed CJ down with the nightstick and busts him where he falls',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).pedestrians?.ready,{timeout:30000}).toBe(true);
 await page.evaluate(()=>(window as any).__game.placePlayer(2491,12.6,1668));await page.waitForTimeout(300);
 await page.evaluate(()=>(window as any).__game.setWantedLevel(1));
 expect(await page.evaluate(()=>(window as any).__game.placeCop(2491,12.6,1674))).toBe(true);
 // SetWeapon: one star and an unarmed suspect, so the cop draws the nightstick.
 await expect.poll(async()=>(await state()).pedestrians.people.some((p:any)=>p.officer&&p.copWeapon==='nightstick'),{timeout:10000}).toBe(true);
 // CJ stands still; the third BBALLBAT swing floors him and the nearest cop arrests him.
 await expect.poll(async()=>(await state()).wanted.arrested,{timeout:90000}).toBe(true);
 const s=await state();
 expect(s.player.health).toBeGreaterThan(0);expect(s.knockdown).toBeGreaterThan(50);
 // CGameLogic takes over: the busted text, with the wanted level kept for the fee until respawn.
 await expect(page.locator('.white-middle-message')).toHaveText('busted');
 expect(s.wanted.level).toBe(1);
 await expect.poll(async()=>(await state()).wanted.arrested,{timeout:20000}).toBe(false);
 expect((await state()).wanted.level).toBe(0);
 // ClearExcitingStuffFromArea (4000 units) at the arrest and the restart point: the arresting cop is gone.
 expect((await state()).pedestrians.people.filter((p:any)=>p.officer).length).toBe(0);
 expect(errors).toEqual([]);
});
