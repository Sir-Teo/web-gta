import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('the Fire Truck sprays a water jet that follows the camera, knocks peds down and drains after the gun is released',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).pedestrians?.ready,{timeout:30000}).toBe(true);
 await expect.poll(async()=>(await state()).nativeCar!=null,{timeout:30000}).toBe(true);
 await page.waitForTimeout(1000);
 // A Fire Truck beside CJ (the cheat spawner), boarded with F.
 await page.evaluate(()=>(window as any).__game.spawnVehicle(407));
 await expect.poll(async()=>((await state()).fleet?.cars??[]).some((c:any)=>c.modelId===407),{timeout:30000}).toBe(true);
 await page.waitForTimeout(1500);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>((await state()).fleet?.cars??[]).some((c:any)=>c.modelId===407&&c.occupied),{timeout:20000}).toBe(true);
 await page.waitForTimeout(800);
 // A civilian 10 m down the truck's line: the 32-section ring reaches about 13 m at 50 steps a second, and the jet
 // has fallen to within √5 units of the ground there.
 const placed=await page.evaluate(()=>{const g=(window as any).__game;const s=g.state();const t=s.fleet.cars.find((c:any)=>c.modelId===407);const h=t.heading;const out:any[]=[];
  for(const d of [10]){const x=t.position.x-Math.sin(h)*d,z=t.position.z-Math.cos(h)*d;const y=g.groundAt(x,z,t.position.y+5);if(y==null)continue;const id=g.placePed(x,y,z);if(id!=null)out.push(id);}
  return out;});
 expect(placed.length).toBeGreaterThan(0);
 await page.waitForTimeout(300);
 expect((await state()).waterCannon.id).toBe(0);
 const hitsBefore=(await state()).pedestrians.hits;
 // Ctrl sprays: live sections and drawn quads within the first second.
 await page.keyboard.down('ControlLeft');
 await expect.poll(async()=>(await state()).waterCannon.sections,{timeout:5000}).toBeGreaterThan(8);
 await expect.poll(async()=>(await state()).waterCannon.drawn,{timeout:5000}).toBeGreaterThan(0);
 const spraying=(await state()).waterCannon;
 // The pitch sits inside the Fire Truck's ±20° clamp (the camera looks down from behind, so the 15° lift nets little).
 expect(spraying.id).not.toBe(0);expect(Math.abs(spraying.pitch)).toBeLessThanOrEqual(20*Math.PI/180+1e-6);
 // A ped in the water falls (CTaskComplexFallAndGetUp) and the hit count rises.
 await expect.poll(async()=>(await state()).pedestrians.hits,{timeout:8000}).toBeGreaterThan(hitsBefore);
 await page.waitForTimeout(500);
 const down=(await state()).pedestrians.people.filter((p:any)=>placed.includes(p.id)&&p.down>0);
 expect(down.length).toBeGreaterThan(0);
 expect(['ko_skid_front','ko_spin_r','ko_skid_back','ko_spin_l']).toContain(down[0].reaction);
 await page.keyboard.up('ControlLeft');
 // The ring drains once the gun is released: 32 frames later the cannon has freed itself.
 await expect.poll(async()=>(await state()).waterCannon.id,{timeout:5000}).toBe(0);
 expect((await state()).waterCannon.drawn).toBe(0);
 expect(errors).toEqual([]);
});
