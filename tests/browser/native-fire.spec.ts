import {test,expect} from '@playwright/test';

test('a molotov lights native fires that burn CJ and a nearby pedestrian',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).pedestrians?.people?.filter((p:any)=>!p.officer&&p.health>0).length??0,{timeout:30000}).toBeGreaterThan(0);
 // CJ on the open road, a civilian four metres away, and a molotov at CJ's feet.
 await page.evaluate(()=>(window as any).__game.placePlayer(2480,12.6,1668));
 // Street civilians arrive once the popcycle targets and the zone roster exist; the debug ped is one of them.
 await expect.poll(async()=>(await state()).pedestrians.people.some((p:any)=>!p.officer&&p.health>0),{timeout:60000}).toBe(true);
 const id=await page.evaluate(()=>(window as any).__game.placePed(2484,12.55,1668));
 await page.waitForTimeout(400);
 const before=(await state()).player.health;
 await page.evaluate(()=>(window as any).__game.explodeAt(2480,12.8,1668,1));
 // The molotov's explosion window sets the ground alight (SetWorldOnFire) and the civilian (SetPedsOnFire, 6-unit box).
 await expect.poll(async()=>(await state()).weapons.fires,{timeout:3000}).toBeGreaterThan(1);
 await expect.poll(async()=>(await state()).pedestrians.people.find((p:any)=>p.id===id)?.health??100,{timeout:5000}).toBeLessThan(100);
 // Standing in the fire, CJ burns: 0.5 health per native frame while alight.
 await expect.poll(async()=>(await state()).player.health,{timeout:5000}).toBeLessThan(before-10);
 // CTaskComplexOnFire: the burning civilian sprints away from CJ without flinching, then dies with KO_SHOT_FRONT_0.
 const burning=(await state()).pedestrians.people.find((p:any)=>p.id===id);
 if(burning.health>0){expect(burning.state).toBe('flee');expect(burning.reaction===null||burning.reaction==='ko_shot_front').toBe(true);}
 await expect.poll(async()=>(await state()).pedestrians.people.find((p:any)=>p.id===id)?.health,{timeout:15000}).toBe(0);
 expect((await state()).pedestrians.people.find((p:any)=>p.id===id).reaction).toBe('ko_shot_front');
 // CFire::ProcessFire keeps the fire on the body, a unit lower, until it burns out.
 const corpse=(await state()).pedestrians.people.find((p:any)=>p.id===id).handle;
 expect((await state()).weapons.pedFires).toContain(corpse);
 expect(errors).toEqual([]);
});
