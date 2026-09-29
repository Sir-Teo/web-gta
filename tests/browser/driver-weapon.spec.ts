import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CPed::RemoveWeaponWhenEnteringVehicle: at the wheel the player holds the SMG slot's weapon (the only one a driver's
 * drive-by fires) and cannot change it; ReplaceWeaponWhenExitingVehicle gives back what he held on foot. */
test('taking the wheel swaps the pistol for the Uzi and getting out gives it back',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>{const s=(window as any).__game.state();return {weapon:s.weapons.id,occupied:s.nativeCar?.occupied,phase:s.carEntry.phase};});
 await expect.poll(async()=>(await state()).occupied,{timeout:60000}).toBe(false);
 await page.keyboard.press('Backquote');await page.locator('[data-weapon="22"]').click();
 await expect.poll(async()=>(await state()).weapon).toBe(22);
 await page.evaluate(()=>{const g=(window as any).__game,c=g.state().nativeCar.position;g.placePlayer(c.x-2.5,c.y-.5,c.z);g.turnPlayer(Math.PI/2);});
 await page.waitForTimeout(600);await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).occupied,{timeout:30000}).toBe(true);
 await expect.poll(async()=>(await state()).weapon).toBe(28);
 // m_bInVehicleDontAllowWeaponChange: the cycling keys do nothing at the wheel.
 await page.keyboard.press('KeyE');await page.waitForTimeout(500);
 expect((await state()).weapon).toBe(28);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).occupied,{timeout:30000}).toBe(false);
 await expect.poll(async()=>(await state()).weapon).toBe(22);
 expect(errors).toEqual([]);
});
