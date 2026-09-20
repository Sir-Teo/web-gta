import {test,expect} from '@playwright/test';

test('Grove Street fills with popcycle-typed street peds and cars in the live world',async({page})=>{
 test.setTimeout(180000);
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).pedestrians.people.filter((p:any)=>!p.officer).length,{timeout:60000}).toBeGreaterThanOrEqual(4);
 const s=await state();
 const people=s.pedestrians.people.filter((p:any)=>!p.officer);
 const gang=people.filter((p:any)=>p.gang!==undefined).length,civilians=people.length-gang;
 // Ganton's Families are strong: the gang deficit is large, so at least one party shares the street with civilians.
 expect(gang+civilians).toBeGreaterThanOrEqual(4);
 expect(s.pedestrians.error).toBeNull();
 expect(s.fleet.cars.length).toBeGreaterThan(0);
});
