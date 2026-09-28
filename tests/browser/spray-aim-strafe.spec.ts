import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** The spray can and fire extinguisher have no bAimWithArm: aimed, CTaskSimplePlayerOnFoot::ProcessPed moves CJ through
 * PlayerControlZeldaWeapon on the GunMove clips at the weapon's move speed, as with a rifle, not at a run. */
test('aiming the spray can or extinguisher strafes on the gun-move clips',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>{const s=(window as any).__game.state();return {action:s.nativeCharacter?.action,speed:s.player.speed,grounded:s.player.grounded};});
 await expect.poll(async()=>(await state()).grounded,{timeout:60000}).toBe(true);
 for(const id of [41,42]){
  await page.keyboard.press('Backquote');await page.locator(`[data-weapon="${id}"]`).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().weapons.ready)).toBe(true);
  await page.mouse.move(700,450);await page.mouse.down({button:'right'});await page.keyboard.down('KeyA');
  await expect.poll(async()=>(await state()).action,{timeout:30000}).toBe('gunMove');
  await page.waitForTimeout(800);
  expect((await state()).speed).toBeLessThan(3);
  await page.keyboard.up('KeyA');await page.mouse.up({button:'right'});await page.waitForTimeout(500);
 }
 expect(errors).toEqual([]);
});
