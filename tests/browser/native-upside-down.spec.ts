import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('an empty car on its roof burns down and blows up',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 // The Greenwood streams in after CJ lands; the tracked car is the one nearest CJ, so he stands ten units from the
 // flipped car and further from the script's parked car generator at (2473.5, 1690).
 await expect.poll(async()=>(await state()).nativeCar!=null,{timeout:30000}).toBe(true);
 await page.evaluate(()=>(window as any).__game.placePlayer(2485,12.6,1672));
 await page.evaluate(()=>(window as any).__game.placeCar(2491,13.3,1680,0));await page.waitForTimeout(500);
 await page.evaluate(()=>(window as any).__game.flipCar());
 // CAutomobile::VehicleDamage: 4 health a frame, 200 a second, into the burning band below 250.
 await expect.poll(async()=>(await state()).nativeCar.health,{timeout:6000}).toBeLessThan(250);
 await expect.poll(async()=>(await state()).nativeCar.wrecked,{timeout:10000}).toBe(true);
 expect(errors).toEqual([]);
});

test("the player's own car on its roof is set alight after about four seconds",async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 // The Greenwood streams in after CJ lands; F does nothing until it is there.
 await expect.poll(async()=>(await state()).nativeCar!=null,{timeout:30000}).toBe(true);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).nativeCar?.occupied,{timeout:15000}).toBe(true);
 await page.waitForTimeout(800);
 await page.evaluate(()=>(window as any).__game.flipCar());
 // Not the fast drain of other cars: the Vice City counter, then a cap at 249.
 await page.waitForTimeout(2000);expect((await state()).nativeCar.health).toBeGreaterThan(900);
 await expect.poll(async()=>(await state()).nativeCar.health,{timeout:8000}).toBeLessThanOrEqual(249);
 expect(errors).toEqual([]);
});
