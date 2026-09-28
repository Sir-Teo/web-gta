import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CTaskComplexJump replaces CTaskSimplePlayerOnFoot from the launch to the landing: the aim button pressed mid-jump
 * neither cuts the jump short nor fires until CJ is back on his feet. */
test('aiming and firing wait for the jump to land',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>{const s=(window as any).__game.state();return {grounded:s.player.grounded,action:s.nativeCharacter?.action,shots:s.weapons.shots};});
 await expect.poll(async()=>(await state()).grounded,{timeout:60000}).toBe(true);
 await page.keyboard.press('Backquote');await page.locator('[data-weapon="22"]').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().weapons.ready)).toBe(true);
 await page.mouse.move(700,450);
 await page.keyboard.press('Space');
 await expect.poll(async()=>(await state()).action,{timeout:10000}).toMatch(/^launch/);
 await page.mouse.down({button:'right'});await page.mouse.down({button:'left'});
 // He leaves the ground, and no shot goes off before he is down again.
 await expect.poll(async()=>(await state()).grounded,{timeout:10000}).toBe(false);
 const air:{grounded:boolean;action:string;shots:number}[]=[];
 for(let s=await state();!s.grounded||/^(launch|landing)/.test(s.action)||s.action==='airborne';s=await state()){air.push(s);await page.waitForTimeout(40);}
 expect(air.every(s=>s.shots===0&&s.action!=='gunMove')).toBe(true);
 await expect.poll(async()=>(await state()).action,{timeout:10000}).toBe('gunMove');
 await page.mouse.up({button:'left'});await page.mouse.up({button:'right'});
 expect(errors).toEqual([]);
});
