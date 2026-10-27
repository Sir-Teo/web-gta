import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('lit headlights draw their beam fans at night and none by day',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await endStoryMission(page);
 await expect.poll(async()=>(await state()).nativeCar!=null,{timeout:30000}).toBe(true);
 // Put the lighting fixture beside the loaded Greenwood; INTRO's last position is not an entry precondition.
 const setup=await page.evaluate(()=>{const g=(window as any).__game,c=g.state().nativeCar.position,p=g.sim.player.position,before={distance:Math.hypot(p.x-c.x,p.z-c.z),position:{...p}};g.placePlayer(c.x-2.5,c.y-.5,c.z);return before;});
 console.log(JSON.stringify({headlightEntrySetup:setup}));
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.sim.player.grounded)).toBe(true);
 await expect(page.locator('.screen-fade')).toHaveCSS('opacity','0');
 // Enter through the ordinary keyboard task, then check noon and 23:00.
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
