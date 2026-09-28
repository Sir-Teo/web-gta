import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** PlayerControlZeldaWeapon leaves the move state ProcessPed reset to PEDMOVE_STILL, and CanPedDuck refuses only a run
 * or a sprint: strafing with a rifle aimed, the duck button crouches CJ. */
test('the duck button crouches CJ while he strafes with a rifle aimed',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const crouched=()=>page.evaluate(()=>(window as any).__game.state().player.crouched as boolean);
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await page.keyboard.press('Backquote');await page.locator('[data-weapon="31"]').click();
 await page.waitForFunction(()=>(window as any).__game.state().weapons.ready,undefined,{timeout:30000});
 await page.mouse.move(700,450);await page.mouse.down({button:'right'});await page.keyboard.down('KeyA');
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().nativeCharacter?.action),{timeout:30000}).toBe('gunMove');
 await page.waitForTimeout(1500);
 await page.keyboard.press('KeyC');
 await expect.poll(crouched,{timeout:5000}).toBe(true);
 await page.keyboard.up('KeyA');await page.mouse.up({button:'right'});
 expect(errors).toEqual([]);
});
