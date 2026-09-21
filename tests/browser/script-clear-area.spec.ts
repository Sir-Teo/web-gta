import {test,expect} from '@playwright/test';
/** CWorld::ClearExcitingStuffFromArea: the peds and cars a radius holds that may be removed go, the fires in
 * it are put out, and the ones the routine exempts — the player's car, a locked one, a ped a script made —
 * stay where they are. */
test('clearing an area takes the street out of it and leaves the script’s own',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 // Wait for the street to have something on it to clear.
 await expect.poll(async()=>await page.evaluate(()=>((window as any).__game.state().pedestrians?.people?.length??0)),{timeout:60000}).toBeGreaterThan(0);

 const out=await page.evaluate(async()=>{
  const game=(window as any).__game,mission=game.missionForProfiling(),p=game.state().player.position;
  // A ped the script made is a mission ped: CanBeDeleted refuses it, so the clear must leave it.
  const mine=mission.peds.create(4,'male01',{x:p.x+2,y:-p.z,z:p.y});
  const deadline=Date.now()+45000;
  while(Date.now()<deadline&&!mission.peds.entity(mine))await new Promise(r=>setTimeout(r,250));
  const before={peds:game.state().pedestrians.people.length,cars:game.state().fleet.cars.length};
  const adapter=(mission as any).runtime.world;
  adapter.clearExcitingStuffFromArea({x:p.x,y:-p.z,z:p.y},60,true);
  await new Promise(r=>setTimeout(r,300));
  const after={peds:game.state().pedestrians.people.length,cars:game.state().fleet.cars.length};
  const survived=mission.peds.exists(mine)&&!!mission.peds.entity(mine);
  mission.peds.delete(mine);
  return {before,after,survived,areas:mission.snapshot().areasCleared};
 });
 // Something was cleared, and the script's own ped was not.
 expect(out.after.peds).toBeLessThan(out.before.peds);
 expect(out.survived).toBe(true);
 expect(out.areas).toBeGreaterThan(0);
 expect(errors).toEqual([]);
});
