import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CTaskSimplePlayerOnFoot::ProcessPlayerWeapon sets MODE_AIMWEAPON only for a weapon it aims: with the mouse camera's
 * nothing-locked target button, a melee, thrown or used weapon sets lookAtTarget and the follow camera stays. A gun
 * still pulls the camera in. */
test('the target button pulls the gun camera in for a gun only',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>{const s=(window as any).__game.state();return {fov:s.camera.fov as number,aiming:s.weapons.aiming,ready:s.weapons.ready,grounded:s.player.grounded};});
 await expect.poll(async()=>(await state()).grounded,{timeout:60000}).toBe(true);
 const fovAiming=async(id:number)=>{
  await page.keyboard.press('Backquote');await page.locator(`[data-weapon="${id}"]`).click();
  await expect.poll(async()=>(await state()).ready).toBe(true);
  const idle=(await state()).fov;
  await page.mouse.move(700,450);await page.mouse.down({button:'right'});await page.waitForTimeout(600);
  const held=(await state()).fov;
  await page.mouse.up({button:'right'});await page.waitForTimeout(600);
  return held-idle;
 };
 // Brass knuckles, grenade, then the pistol.
 expect(await fovAiming(1)).toBe(0);
 expect(await fovAiming(16)).toBe(0);
 expect(await fovAiming(22)).toBeLessThan(0);
 expect(errors).toEqual([]);
});
