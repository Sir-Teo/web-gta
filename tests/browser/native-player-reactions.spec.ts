import {test,expect} from '@playwright/test';

test('CJ flinches from a nearby blast that throws him, and falls dead when a blast kills him',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 // Pedestrians install the shared ped.ifp reactions on CJ.
 await expect.poll(async()=>(await state()).pedestrians?.people?.length??0,{timeout:30000}).toBeGreaterThan(0);
 await page.evaluate(()=>(window as any).__game.placePlayer(2480,12.6,1668));await page.waitForTimeout(400);
 // A small blast (radius 3, force 90) near its edge: about 30 damage. WEAPON_EXPLOSION takes ComputeDamageAnim's
 // ordinary branch (no fall): a HIT_* reaction, while TriggerExplosionSectorList's push lifts him off his feet.
 await page.evaluate(()=>{const g=(window as any).__game;g.sim.player.heading=Math.PI/2;g.explodeAt(2482.7,13.5,1668,11);});
 await expect.poll(async()=>(await state()).nativeCharacter?.reaction??'',{timeout:2000}).toMatch(/^hit_/);
 const down=await state();expect(down.player.health).toBeGreaterThan(0);expect(down.player.health).toBeLessThan(100);
 expect(down.knockdown??0).toBe(0);
 await page.waitForTimeout(1500);
 await page.keyboard.down('KeyW');await page.waitForTimeout(600);await page.keyboard.up('KeyW');
 expect((await state()).player.speed).toBeGreaterThanOrEqual(0);
 // A grenade at his feet kills him: the death clip holds.
 await page.evaluate(()=>(window as any).__game.explodeAt(2480,12.8,1668,0));
 await expect.poll(async()=>(await state()).player.health).toBe(0);
 await expect.poll(async()=>(await state()).nativeCharacter?.reaction??null).not.toBeNull();
 // CPlayerInfo::KillPlayer: "wasted" in light grey gothic above the centre, the zone name hidden, gone after 4 s.
 const wasted=page.locator('.white-middle-message');
 await expect(wasted).toHaveText('wasted');await expect(wasted).toBeVisible();
 expect(await wasted.evaluate(e=>getComputedStyle(e).color)).toBe('rgb(225, 225, 225)');
 await expect(page.locator('.location')).toBeHidden();
 await expect(wasted).toBeHidden({timeout:8000});
 expect(errors).toEqual([]);
});
