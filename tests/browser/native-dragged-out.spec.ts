import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('a cop drags CJ out of his car onto the ground and busts him there',async({page})=>{
 test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).pedestrians?.ready,{timeout:30000}).toBe(true);
 // The Greenwood streams in after CJ lands; F does nothing until it is there.
 await expect.poll(async()=>(await state()).nativeCar!=null,{timeout:30000}).toBe(true);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).nativeCar?.occupied,{timeout:15000}).toBe(true);
 await page.waitForTimeout(800);
 await page.evaluate(()=>(window as any).__game.setWantedLevel(2));
 // A cop beside the driver's door, with his pistol drawn at two stars.
 const car=(await state()).nativeCar.position;
 expect(await page.evaluate(({x,y,z})=>(window as any).__game.placeCop(x-3,y-.7,z),car)).toBe(true);
 await page.waitForTimeout(500);
 expect(await page.evaluate(()=>(window as any).__game.dragPlayerOut())).toBe(true);
 // CAR_jackedLHS plays through the door, then CJ lies on the ground on foot.
 await expect.poll(async()=>(await state()).carEntry.phase??null,{timeout:3000}).toBe('draggedOut');
 await expect.poll(async()=>(await state()).nativeCar.occupied,{timeout:8000}).toBe(false);
 // CTaskComplexArrestPed: a falling suspect within 3 units of a cop is arrested.
 await expect.poll(async()=>(await state()).wanted.arrested,{timeout:8000}).toBe(true);
 await expect(page.locator('.white-middle-message')).toHaveText('busted');
 expect(errors).toEqual([]);
});
