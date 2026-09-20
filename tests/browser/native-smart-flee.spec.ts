import {test,expect} from '@playwright/test';
// CTaskComplexSmartFleeEntity(firedBy, 60): a ped that hears the player's shot sprints away until it is 60 from him.
test('peds that hear the player fire flee him to 60 units, then stop fleeing',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state().weapons?.ready&&(window as any).__game.state().nativeCharacter&&((window as any).__game.state().pedestrians?.people??[]).length>0,undefined,{timeout:60000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await page.keyboard.press('Tab');await page.locator('[data-weapon="22"]').click();await expect.poll(async()=>(await state()).weapons.ready).toBe(true);
 const s0=await state(),p=s0.player.position,h=s0.player.heading;
 // Eight units to the side, out of the line of fire.
 // Street civilians arrive once the popcycle targets and the zone roster exist; the debug ped is one of them.
 await expect.poll(async()=>(await state()).pedestrians.people.some((p:any)=>!p.officer&&p.health>0),{timeout:60000}).toBe(true);
 const id=await page.evaluate(([x,y,z])=>(window as any).__game.placePed(x,y,z),[p.x+Math.cos(h)*8,p.y,p.z-Math.sin(h)*8]);
 await page.waitForTimeout(300);
 await page.mouse.move(720,300);await page.mouse.down({button:'right'});await page.waitForTimeout(300);await page.mouse.down();await page.waitForTimeout(60);await page.mouse.up();await page.mouse.up({button:'right'});
 let last={state:'',distance:0},beyond25At=0;
 const ped=async()=>{const s=await state(),q=s.pedestrians.people.find((x:any)=>x.id===id);if(!q)return {state:'removed',distance:last.distance};last={state:q.state,distance:Math.hypot(q.position.x-s.player.position.x,q.position.z-s.player.position.z)};if(last.distance>25&&!beyond25At)beyond25At=Date.now();return last;};
 await expect.poll(async()=>(await ped()).state).toBe('flee');
 await expect.poll(async()=>(await ped()).state,{timeout:30000}).not.toBe('flee');
 // The flee ends at 60 units; CPopulation::ManagePed removes an off-screen ped 4 s after it passed 25 units, so the
 // runner may be gone first, but not before that.
 const end=await ped();
 if(end.state==='removed'){expect(end.distance).toBeGreaterThan(25);expect(Date.now()-beyond25At).toBeGreaterThanOrEqual(3000);}
 else expect(end.distance).toBeGreaterThanOrEqual(59.5);
 expect(errors).toEqual([]);
});
