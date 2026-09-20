import {test,expect} from '@playwright/test';

// COcclusion: occluLA.ipl puts a 34 x 9 x 4 occluder wall at native (2502, -1718.7) south of Grove Street. Facing it from
// twelve units north, the wall becomes an active occluder and the placements behind it are culled.
test('the Grove Street occluder wall hides the placements behind it',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(async()=>(await state()).occlusion.occluders,{timeout:60000}).toBeGreaterThan(900);
 expect((await state()).occlusion.interior).toBe(33);
 // The Grove Street spawn view: whatever the pass culls there must not open holes (artifacts/native-occlusion-spawn.png).
 await page.waitForTimeout(1500);const spawn=(await state()).occlusion;
 await page.screenshot({path:'artifacts/native-occlusion-spawn.png'});
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2502,13.5,1706);g.turnPlayer(0);});
 await page.waitForTimeout(1500);
 await expect.poll(async()=>(await state()).occlusion.active,{timeout:8000}).toBeGreaterThan(0);
 await expect.poll(async()=>(await state()).occlusion.culled,{timeout:8000}).toBeGreaterThan(0);
 const facing=await state();
 // Turned to face north, away from every nearby occluder, nothing is culled.
 await page.evaluate(()=>(window as any).__game.turnPlayer(Math.PI));
 await page.waitForTimeout(1500);
 const away=await state();
 expect(away.occlusion.culled).toBeLessThan(facing.occlusion.culled);
 await page.evaluate(()=>(window as any).__game.turnPlayer(0));await page.waitForTimeout(1200);
 await page.screenshot({path:'artifacts/native-occlusion.png'});
 expect(errors).toEqual([]);
 console.log(JSON.stringify({spawn,facing:facing.occlusion,away:away.occlusion}));
});
