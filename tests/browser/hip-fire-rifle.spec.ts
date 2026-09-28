import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CTaskSimplePlayerOnFoot::ProcessPlayerWeapon starts CTaskSimpleUseGun on the fire button alone. A rifle has no
 * bAimWithArm, so ProcessPed moves CJ through PlayerControlZeldaWeapon (the GunMove strafe) and keeps him turned to the
 * follow camera's heading: fired while walking sideways, he strafes instead of turning to walk left. */
test('firing a rifle without aiming strafes facing the camera',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>{const s=(window as any).__game.state();return {action:s.nativeCharacter?.action,heading:s.player.heading as number,yaw:s.camera.yaw as number,grounded:s.player.grounded};});
 await expect.poll(async()=>(await state()).grounded,{timeout:60000}).toBe(true);
 await page.keyboard.press('Tab');await page.locator('[data-weapon="31"]').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().weapons.ready)).toBe(true);
 await page.keyboard.down('Control');await page.keyboard.down('KeyA');
 await expect.poll(async()=>(await state()).action,{timeout:30000}).toBe('gunMove');
 await page.waitForTimeout(1200);
 const now=await state(),off=Math.abs(Math.atan2(Math.sin(now.heading-now.yaw-Math.PI),Math.cos(now.heading-now.yaw-Math.PI)));
 await page.keyboard.up('KeyA');await page.keyboard.up('Control');
 expect(off).toBeLessThan(.3);
 expect(errors).toEqual([]);
});
