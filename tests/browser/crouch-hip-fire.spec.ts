import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CTaskSimpleUseGun::SetMoveAnim: ducked, with its last command FIRE, FIREBURST or RELOAD, the duck is ForceStopMove'd.
 * The fire button alone starts the use-gun task, so hip-firing crouched plants CJ as aiming does. */
test('hip-firing crouched stops the crouch-walk',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>{const s=(window as any).__game.state();return {p:{...s.player.position},crouched:s.player.crouched,grounded:s.player.grounded};});
 await expect.poll(async()=>(await state()).grounded,{timeout:60000}).toBe(true);
 await page.keyboard.press('Tab');await page.locator('[data-weapon="31"]').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().weapons.ready)).toBe(true);
 await page.keyboard.press('KeyC');
 await expect.poll(async()=>(await state()).crouched,{timeout:5000}).toBe(true);
 await page.keyboard.down('KeyW');await page.waitForTimeout(600);
 await page.keyboard.down('Control');await page.waitForTimeout(300);
 const a=(await state()).p;await page.waitForTimeout(800);const b=(await state()).p;
 await page.keyboard.up('Control');await page.keyboard.up('KeyW');
 expect(Math.hypot(b.x-a.x,b.z-a.z)).toBeLessThan(.15);
 expect(errors).toEqual([]);
});
