import {test,expect} from '@playwright/test';

test('a ped in the path of a honking car steps or dives out of the way',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).pedestrians?.ready,{timeout:30000}).toBe(true);
 await page.evaluate(()=>(window as any).__game.placePlayer(2485,12.6,1690));
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
