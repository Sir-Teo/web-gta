import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CTaskComplexArrestPed on a suspect riding a bike: TASK_COMPLEX_DRAG_PED_FROM_CAR pulls him off (CTaskSimpleBikeJacked,
 * BIKE_FALL_OFF), and a cop within 3 units of him while he falls arrests him. */
test('a cop pulls CJ off his bike and busts him where he falls',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>(await state()).pedestrians?.ready,{timeout:30000}).toBe(true);
 await page.evaluate(()=>(window as any).__game.spawnVehicle(522));
 await expect.poll(()=>page.evaluate(()=>[...(window as any).__game.fleet().bikes].length),{timeout:30000}).toBeGreaterThan(0);
 await expect.poll(()=>page.evaluate(()=>{const g=(window as any).__game;return g.bikeMount().ready([...g.fleet().bikes][0]);}),{timeout:30000}).toBe(true);
 await page.evaluate(()=>{const g=(window as any).__game,t=[...g.fleet().bikes][0].body.translation();g.placePlayer(t.x+1.5,g.groundAt(t.x+1.5,t.z,t.y+5)+.05,t.z);});
 await expect.poll(async()=>{const s=await state();return !s.terrainHold&&s.player.grounded;},{timeout:30000}).toBe(true);
 await page.waitForTimeout(500);
 await page.keyboard.press('KeyF');
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.fleet().occupiedBike),{timeout:90000}).toBe(true);
 await page.waitForTimeout(800);
 await page.evaluate(()=>(window as any).__game.setWantedLevel(1));
 const at=await page.evaluate(()=>({...[...(window as any).__game.fleet().bikes][0].body.translation()}));
 expect(await page.evaluate(({x,y,z})=>(window as any).__game.placeCop(x-2,y-.5,z),at)).toBe(true);
 await page.waitForTimeout(500);
 expect(await page.evaluate(()=>[...(window as any).__game.fleet().bikes][0].pulledOff())).toBe(true);
 expect(await page.evaluate(()=>!!(window as any).__game.fleet().occupiedBike)).toBe(false);
 await expect.poll(async()=>(await state()).wanted.arrested,{timeout:10000}).toBe(true);
 expect(errors).toEqual([]);
});
