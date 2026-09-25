import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** SET_VEHICLE_IS_CONSIDERED_BY_PLAYER (RYDER2, MAF4, QUARRY): CVehicle::bConsideredByPlayer, which the player's
 * search for a vehicle to enter passes over while it is clear. */
test('the player cannot pick a car the script took out of his consideration',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position,h=g.state().player.heading;
  return g.missionForProfiling().vehicles.create(429,{x:p.x+Math.sin(h)*3.5,y:-(p.z+Math.cos(h)*3.5),z:-100},0);});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),car,{timeout:60000});
 await page.waitForTimeout(1500);
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 const entering=()=>page.evaluate(()=>(window as any).__game.state().carEntry.car);
 await w('setVehicleIsConsideredByPlayer',car,false);
 await page.keyboard.press('KeyF');await page.waitForTimeout(800);
 expect(await entering()).not.toBe(429);
 await page.keyboard.press('KeyF');await page.waitForTimeout(300);
 await w('setVehicleIsConsideredByPlayer',car,true);
 await expect.poll(async()=>{await page.keyboard.press('KeyF');await page.waitForTimeout(600);return entering();},{timeout:20000}).toBe(429);
 expect(errors).toEqual([]);
});
