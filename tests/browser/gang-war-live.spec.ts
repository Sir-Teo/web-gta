import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('provoking a war in Ballas turf starts the waves: attackers arrive, and clearing them shifts the zone to the Families',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).pedestrians?.ready,{timeout:30000}).toBe(true);
 await expect.poll(async()=>(await state()).gangWars!=null,{timeout:30000}).toBe(true);
 // East Los Santos (ELS4), Ballas turf north of Grove Street (native x 2527, y -1541): held at 120 up while the
 // terrain window streams in under him, then set on the ground, since the whole drop would kill him and the war's
 // zone would be the one around County General's door.
 await page.evaluate(()=>(window as any).__game.placePlayer(2527,120,1541));
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.groundAt(2527,1541,100)),{timeout:90000}).not.toBeNull();
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2527,g.groundAt(2527,1541,100)+.05,1541);});
 await page.waitForTimeout(1000);
 await expect.poll(async()=>(await state()).player.grounded,{timeout:90000}).toBe(true);
 await expect.poll(async()=>(await state()).gangWars?.here?.gangStrength?.[0]??0,{timeout:30000}).toBeGreaterThanOrEqual(20);
 await page.waitForTimeout(1500);
 const strengths=async()=>{const h=(await state()).gangWars.here;return {ballas:h.gangStrength[0],grove:h.gangStrength[1]};};
 const before=await strengths();
 // Three kills' worth of provocation: the war starts in the zone the player stands in.
 await page.evaluate(()=>{(window as any).__game.gangWars().provocation=3;});
 await expect.poll(async()=>(await state()).gangWars.state,{timeout:5000}).toBe(1);
 const started=(await state()).gangWars;
 expect(started.gang1).toBe(0);expect(started.zone).toBeTruthy();
 // The first wave stands within the 10 s wait plus loading; its attackers are armed gang peds on the kill task.
 await expect.poll(async()=>(await state()).gangWars.state,{timeout:60000}).toBe(2);
 await expect.poll(async()=>((await state()).pedestrians.people as any[]).filter(p=>p.attackWave).length,{timeout:20000}).toBeGreaterThanOrEqual(4);
 const wave=((await state()).pedestrians.people as any[]).filter(p=>p.attackWave);
 expect(wave.every(p=>p.gang===0)).toBe(true);
 // CreateAttackWave's drive-by car: Ballas, crewed, on its way in (it waits for the collision 160 units out first).
 await expect.poll(async()=>((await state()).driveby?.units??[]).filter((u:any)=>u.wave&&u.gang===0).length,{timeout:20000}).toBe(1);
 // Clearing the wave moves 30 % of the Ballas strength to the Families and readies the second wave.
 for(const p of wave)await page.evaluate(id=>(window as any).__game.killPed(id),p.id);
 await expect.poll(async()=>(await state()).gangWars.state,{timeout:20000}).toBe(3);
 const after=await strengths();
 expect(after.ballas).toBe(Math.trunc(before.ballas*.7));expect(after.grove).toBe(before.grove+before.ballas-after.ballas);
 expect((await state()).player.health).toBeGreaterThan(0);
 expect(errors).toEqual([]);
});
