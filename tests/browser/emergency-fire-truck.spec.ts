import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';

const emergency=(page:Page)=>page.evaluate(()=>(window as any).__game.state().emergency);

// GenerateEmergencyServicesCar's fire engine (AUTHORED from III/VC): three fires within 30 units of CJ bring one with
// its siren on; CTaskComplexDriveFireTruck drives it to within 25 units of the nearest, and CTaskComplexUseWaterCannon's
// FireTruckControl turns the nozzle onto the fire and puts it out (CFire::ExtinguishWithWater).
test('three fires in Grove Street bring a fire engine whose cannon puts them out',async({page})=>{
 test.setTimeout(420000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>(await emergency(page))?.ready,{timeout:60000}).toBe(true);
 // Three world fires in the street west of CJ (native axes), burning two minutes.
 await page.evaluate(()=>{const g=(window as any).__game,w=g.weapons(),p=g.sim.player.position;
  for(const dx of [-14,-17,-20])w.fires.startFire({x:p.x+dx,y:-p.z,z:p.y-.9},120000,0,{nowMs:w.nowMs,random:Math.random});});
 expect(await page.evaluate(()=>(window as any).__game.weapons().fires.active.length)).toBeGreaterThanOrEqual(3);
 await expect.poll(async()=>(await emergency(page)).trucks.length,{timeout:60000}).toBeGreaterThan(0);
 expect((await emergency(page)).trucks[0].siren).toBe(true);
 // The truck reaches its 25 units and turns its cannon on.
 await expect.poll(async()=>(await emergency(page)).trucks[0]?.mission,{timeout:150000,intervals:[1000]}).toBe('cannon');
 await page.waitForTimeout(3000);
 await page.evaluate(()=>{const g=(window as any).__game,t=g.state().emergency.trucks[0],me=g.state().player.position;g.render().yaw=Math.atan2(t.position.x-me.x,t.position.z-me.z)+Math.PI;});
 await page.waitForTimeout(1500);
 await page.screenshot({path:'artifacts/emergency-fire-truck.png'});
 // The water puts the fire it is turned on out long before its two minutes are up. (A fire the jet only grazed stays
 // m_IsBeingExtinguished, which FindNearestFire passes over, so the truck may leave it to burn down, as in the original.)
 await expect.poll(async()=>page.evaluate(()=>(window as any).__game.weapons().fires.active.length),{timeout:90000,intervals:[1000]}).toBeLessThan(3);
 expect(errors).toEqual([]);
});
