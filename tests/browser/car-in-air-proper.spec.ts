import {test,expect} from '@playwright/test';

test('IS_CAR_IN_AIR_PROPER: a car on its wheels is not in the air, so ordinary driving earns no insane stunt bonus',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).nativeCar!=null,{timeout:30000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.missionForProfiling()?.runtime),{timeout:60000}).toBe(true);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).nativeCar?.occupied,{timeout:15000}).toBe(true);
 await page.waitForTimeout(1000);
 // The wheels rest on the road, a building: AddCollisionRecord puts it among the car's colliding entities.
 const inAir=()=>page.evaluate(()=>(window as any).__game.missionForProfiling().world.playerPed().vehicle.inAirProper());
 expect(await inAir()).toBe(false);
 // Driving on: still on the ground, and HJ has no stunt to pay for.
 const money=(await state()).money;
 await page.keyboard.down('KeyW');await page.waitForTimeout(2500);expect(await inAir()).toBe(false);await page.keyboard.up('KeyW');
 await page.waitForTimeout(1500);
 expect((await state()).money).toBe(money);
 expect(errors).toEqual([]);
});
