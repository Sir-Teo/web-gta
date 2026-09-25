import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** A script's bike stays however far the player goes, until the script lets it go: the population culled any bike
 * 350 units off, which took INTRO1's parked BMX from under the script. Let go, an area clear takes it. */
test('a script bike 400 units from the player is still there',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const bike=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().vehicles.create(481,{x:p.x+6,y:-p.z,z:-100},0);});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),bike,{timeout:60000});
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 const start=await w('pedPosition',1) as {x:number;y:number;z:number};
 await w('setPedCoordinates',1,start.x-400,start.y,-100);
 await expect.poll(async()=>{const p=await w('pedPosition',1) as {x:number};return Math.abs(p.x-(start.x-400));},{timeout:60000}).toBeLessThan(5);
 await page.waitForTimeout(5000);
 expect(await page.evaluate(h=>(window as any).__game.missionForProfiling().vehicles.entity(h)?.disposed,bike)).toBe(false);
 expect(await w('vehicleExists',bike)).toBe(true);
 // Let go, it is the population's again, and CLEAR_AREA_OF_CARS takes a bike as it takes a car
 // (CWorld::ClearCarsFromArea walks every vehicle).
 const entity=await page.evaluate(h=>{const e=(window as any).__game.missionForProfiling().vehicles.entity(h);(window as any).__farBike=e;return !!e;},bike);
 expect(entity).toBe(true);
 await w('markVehicleNoLongerNeeded',bike);
 const at={x:start.x+6,y:start.y};
 await w('clearAreaOfVehicles',{x:at.x-20,y:at.y-20,z:-50},{x:at.x+20,y:at.y+20,z:200});
 expect(await page.evaluate(()=>(window as any).__farBike.disposed)).toBe(true);
 expect(errors).toEqual([]);
});
