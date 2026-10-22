import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('live script vehicles and player snapshots use native handling appearances',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const setup=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.sim.player.position,base={x:p.x,y:-p.z,z:p.y};return{base,handles:[400,481,487,454,511].map((model,i)=>m.vehicles.create(model,{x:base.x+20+i*12,y:base.y,z:base.z+4},0))};});
 await page.waitForFunction(handles=>handles.every(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h)),setup.handles,{timeout:90000});
 const appearances=await page.evaluate(handles=>{const m=(window as any).__game.missionForProfiling();return handles.map(h=>m.runtime.world.vehicleAppearance(h));},setup.handles);expect(appearances).toEqual([1,2,3,4,5]);
 for(const index of[2,4,3,1]){
  await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCar(1,h),setup.handles[index]);
  await expect.poll(()=>page.evaluate(()=>{const m=(window as any).__game.missionForProfiling();return m.world.playerPed().vehicle?.appearance;}),{timeout:30000}).toBe(appearances[index]);
  expect(await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling(),w=m.runtime.world;return w.vehicleAppearance(w.pedVehicle(1));})).toBe(appearances[index]);
  await page.evaluate(base=>(window as any).__game.missionForProfiling().runtime.world.warpPedFromCarToCoord(1,base.x,base.y,base.z),setup.base);
  await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().world.playerPed().vehicle===undefined),{timeout:30000}).toBe(true);
 }
 expect(errors).toEqual([]);
});
