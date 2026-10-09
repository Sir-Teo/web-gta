import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('lit headlights draw their beam fans at night and none by day',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await endStoryMission(page);
 await expect.poll(async()=>(await state()).nativeCar!=null,{timeout:30000}).toBe(true);
 // CJ at the Greenwood's wheel (a parked car's lights stay off), at noon and at 23:00.
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).nativeCar?.occupied,{timeout:15000}).toBe(true);
 await page.evaluate(()=>{(window as any).__game.sim.timeMinutes=12*60;});
 await page.waitForTimeout(1500);
 expect((await state()).headlightBeams).toBe(0);
 await page.evaluate(()=>{(window as any).__game.sim.timeMinutes=23*60;});
 await expect.poll(async()=>(await state()).headlightBeams,{timeout:10000}).toBeGreaterThan(0);
 // Two lamps, four triangles each: 24 vertices for the Greenwood alone (traffic may add more).
 expect((await state()).headlightBeams%24).toBe(0);
 // CVehicle::DoHeadLightReflection: the twin road pool under the Greenwood's lamps.
 await expect.poll(async()=>(await state()).carLightPools,{timeout:10000}).toBeGreaterThan(0);
 await page.screenshot({path:test.info().outputPath('night-side.png')});
 expect(errors).toEqual([]);
});
