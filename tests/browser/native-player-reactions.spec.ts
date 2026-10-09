import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('a nearby blast that throws CJ plays no flinch, and one that kills him drops him dead',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 // Pedestrians install the shared ped.ifp reactions on CJ.
 await expect.poll(async()=>(await state()).pedestrians?.people?.length??0,{timeout:30000}).toBeGreaterThan(0);
 // Off the opening, whose cutscenes make CJ safe (MAKE_PLAYER_SAFE_FOR_CUTSCENE).
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.missionForProfiling()),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 await page.evaluate(()=>(window as any).__game.placePlayer(2480,12.6,1668));
 // Standing, out of the placement's drop: a blast on CJ still in the air (CTaskSimpleInAir) or landing plays no flinch.
 await expect.poll(async()=>{const s=await state();return s.player.grounded&&!/^(airborne|landing|launch)/.test(s.nativeCharacter?.action??'');},{timeout:10000}).toBe(true);
 // A small blast (radius 3, force 90) near its edge: about 30 damage. WEAPON_EXPLOSION is no weapon to
 // CWeaponInfo::TypeIsWeapon, so ComputeDamageResponse gives it no hit reaction: only TriggerExplosionSectorList's push
 // lifts him off his feet.
 // No armour: Explore's CJ wears some, which would take the blast before his health (AccountForPedArmour).
 await page.evaluate(()=>{const g=(window as any).__game;g.sim.player.armour=0;g.sim.player.heading=Math.PI/2;g.explodeAt(2482.7,13.5,1668,11);});
 await expect.poll(async()=>(await state()).player.health,{timeout:5000}).toBeLessThan(100);
 for(let i=0;i<8;i++){expect((await state()).nativeCharacter?.reaction??'').not.toMatch(/^hit_/);await page.waitForTimeout(100);}
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
 // CGameLogic waits for PEDSTATE_DEAD: the death clip plays out and the thrown body lands first.
 await expect(wasted).toHaveText('wasted',{timeout:60000});await expect(wasted).toBeVisible();
 expect(await wasted.evaluate(e=>getComputedStyle(e).color)).toBe('rgb(225, 225, 225)');
 await expect(page.locator('.location')).toBeHidden();
 // Four seconds of game time: a frame advances the clock by 100 ms at most, and under a software renderer the page
 // draws only a few frames a second, so the wall-clock wait is far longer than the message.
 await expect(wasted).toBeHidden({timeout:60000});
 expect(errors).toEqual([]);
});
