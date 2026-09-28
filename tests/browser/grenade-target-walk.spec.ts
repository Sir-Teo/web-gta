import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** ProcessPlayerWeapon never aims a thrown weapon with nothing locked (lookAtTarget): PlayerControlZelda steers CJ by
 * the stick. Holding the target button with a grenade and walking left turns him to walk left, not slide sideways
 * facing the camera. */
test('the target button with a grenade leaves CJ steering by the stick',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>{const s=(window as any).__game.state();return {heading:s.player.heading as number,yaw:s.camera.yaw as number,grounded:s.player.grounded};});
 await expect.poll(async()=>(await state()).grounded,{timeout:60000}).toBe(true);
 await page.keyboard.press('Backquote');await page.locator('[data-weapon="16"]').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().weapons.ready)).toBe(true);
 await page.mouse.move(700,450);await page.mouse.down({button:'right'});await page.keyboard.down('KeyA');
 await page.waitForTimeout(1500);
 const s=await state();
 await page.keyboard.up('KeyA');await page.mouse.up({button:'right'});
 // Facing the camera would leave heading - (yaw + π) near 0; walking left turns him about a quarter turn from it.
 const off=Math.abs(Math.atan2(Math.sin(s.heading-s.yaw-Math.PI),Math.cos(s.heading-s.yaw-Math.PI)));
 expect(off).toBeGreaterThan(1);
 expect(errors).toEqual([]);
});
