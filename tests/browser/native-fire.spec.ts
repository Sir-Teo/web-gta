import {test,expect} from '@playwright/test';

test('a molotov lights native fires that burn CJ and a nearby pedestrian',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).pedestrians?.people?.filter((p:any)=>!p.officer&&p.health>0).length??0,{timeout:30000}).toBeGreaterThan(0);
 // CJ on the open road, a civilian four metres away, and a molotov at CJ's feet.
 await page.evaluate(()=>(window as any).__game.placePlayer(2480,12.6,1668));
 const id=await page.evaluate(()=>(window as any).__game.placePed(2484,12.55,1668));
 await page.waitForTimeout(400);
 const before=(await state()).player.health;
 await page.evaluate(()=>(window as any).__game.explodeAt(2480,12.8,1668,1));
 // The molotov's explosion window sets the ground alight (SetWorldOnFire) and the civilian (SetPedsOnFire, 6-unit box).
 await expect.poll(async()=>(await state()).weapons.fires,{timeout:3000}).toBeGreaterThan(1);
 await expect.poll(async()=>(await state()).pedestrians.people.find((p:any)=>p.id===id)?.health??100,{timeout:5000}).toBeLessThan(100);
 // Standing in the fire, CJ burns: 0.5 health per native frame while alight.
 await expect.poll(async()=>(await state()).player.health,{timeout:5000}).toBeLessThan(before-10);
 expect(errors).toEqual([]);
});
