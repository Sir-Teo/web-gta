import {test,expect} from '@playwright/test';

test('a ped in the path of a honking car steps or dives out of the way',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).pedestrians?.ready,{timeout:30000}).toBe(true);
 // The car hooks move the car nearest CJ, so he stands off to the side, nearer this car than the script's parked ones.
 await page.evaluate(()=>(window as any).__game.placePlayer(2480,12.6,1676));
 await page.evaluate(()=>(window as any).__game.placeCar(2491,13.3,1680,0));
 // Street civilians arrive once the popcycle targets and the zone roster exist; the debug ped is one of them.
 await expect.poll(async()=>(await state()).pedestrians.people.some((p:any)=>!p.officer&&p.health>0),{timeout:60000}).toBe(true);
 const id=await page.evaluate(()=>(window as any).__game.placePed(2491,12.55,1669));
 await page.waitForTimeout(500);
 const start=(await state()).pedestrians.people.find((p:any)=>p.id===id).position;
 // The empty car rolls at the ped with its horn going: nine in ten frames an unwarned ped would stay put.
 await page.evaluate(()=>{const g=(window as any).__game;g.setHorn(100);g.launchCar(12);});
 const seen:string[]=[];
 for(let i=0;i<40;i++){
  const ped=(await state()).pedestrians.people.find((p:any)=>p.id===id);
  if(ped?.evade&&seen.at(-1)!==ped.evade)seen.push(ped.evade);
  await page.waitForTimeout(50);
 }
 expect(seen.length,JSON.stringify(seen)).toBeGreaterThan(0);
 // CTaskComplexEvasiveStep or CTaskComplexEvasiveDiveAndGetUp: turn first, then the move.
 expect(seen[0]).toMatch(/^(step|dive):/);expect(seen.some(s=>s.endsWith(':move'))).toBe(true);
 const end=(await state()).pedestrians.people.find((p:any)=>p.id===id);
 // Out of the car's lane: the step backs a unit sideways, the dive carries several.
 expect(Math.abs(end.position.x-start.x)).toBeGreaterThan(.6);
 expect(errors).toEqual([]);
});

test('a beat cop in the path of a honking car gets out of the way too',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).pedestrians?.ready,{timeout:30000}).toBe(true);
 await page.evaluate(()=>(window as any).__game.placePlayer(2480,12.6,1676));
 await page.evaluate(()=>(window as any).__game.placeCar(2491,13.3,1680,0));
 // CEventPotentialGetRunOver::AffectsPed asks only for a live ped out of a vehicle: an officer answers it as well.
 expect(await page.evaluate(()=>(window as any).__game.placeCop(2491,12.55,1669))).toBe(true);
 const cop=async()=>(await state()).pedestrians.people.filter((p:any)=>p.officer&&p.health>0).sort((a:any,b:any)=>Math.hypot(a.position.x-2491,a.position.z-1669)-Math.hypot(b.position.x-2491,b.position.z-1669))[0];
 await expect.poll(async()=>{const c=await cop();return c?Math.hypot(c.position.x-2491,c.position.z-1669):99;},{timeout:20000}).toBeLessThan(1.5);
 const id=(await cop()).id;
 await page.evaluate(()=>{const g=(window as any).__game;g.setHorn(100);g.launchCar(12);});
 const seen:string[]=[];
 for(let i=0;i<40;i++){
  const ped=(await state()).pedestrians.people.find((p:any)=>p.id===id);
  if(ped?.evade&&seen.at(-1)!==ped.evade)seen.push(ped.evade);
  await page.waitForTimeout(50);
 }
 expect(seen.length,JSON.stringify(seen)).toBeGreaterThan(0);
 expect(seen[0]).toMatch(/^(step|dive):/);
 expect(errors).toEqual([]);
});

test('a ped fighting CJ at the roadside still gets out of a car\'s way',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).pedestrians?.ready,{timeout:30000}).toBe(true);
 await page.evaluate(()=>(window as any).__game.placePlayer(2489.2,12.6,1669));
 await page.evaluate(()=>(window as any).__game.placeCar(2491,13.3,1680,0));
 await expect.poll(async()=>(await state()).pedestrians.people.some((p:any)=>!p.officer&&p.health>0),{timeout:60000}).toBe(true);
 const id=await page.evaluate(()=>(window as any).__game.placePed(2491,12.55,1669));
 // CEventPotentialGetRunOver (51) outranks the hated sighting's kill task (26): the fight does not keep him in the lane.
 await page.evaluate(id=>{const p=(window as any).__game.pedestrians().people.find((q:any)=>q.id===id);p.retaliate=60;p.foe=undefined;p.event=undefined;},id);
 await page.waitForTimeout(300);
 await page.evaluate(()=>{const g=(window as any).__game;g.setHorn(100);g.launchCar(12);});
 const seen:string[]=[];
 for(let i=0;i<40;i++){
  const ped=(await state()).pedestrians.people.find((p:any)=>p.id===id);
  if(ped?.evade&&seen.at(-1)!==ped.evade)seen.push(ped.evade);
  await page.waitForTimeout(50);
 }
 expect(seen.length,JSON.stringify(seen)).toBeGreaterThan(0);
 expect(errors).toEqual([]);
});
