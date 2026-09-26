import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** DELETE_CAR on the car the player drives: CVehicle's destructor flags its driver (FlagToDestroyWhenNextProcessed),
 * which leaves the player out of it where he sat. The car used to go with him still counted in it, and the next
 * frame's reads of its freed body broke the physics world for good. */
test('a script deletes the car the player is driving and he is left standing where he sat',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().vehicles.create(400,{x:p.x+6,y:-p.z,z:-100},0);});
 await page.waitForFunction((h:number)=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),car,{timeout:60000});
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 await w('warpPedIntoCar',1,car);
 expect(await w('pedVehicle',1)).toBe(car);
 const seat=await w('vehiclePosition',car);
 await w('deleteVehicle',car);
 expect(await w('pedVehicle',1)).toBeUndefined();
 const at=await w('pedPosition',1);expect(Math.hypot(at.x-seat.x,at.y-seat.y)).toBeLessThan(3);
 // The world goes on: he walks, and nothing faulted.
 await page.waitForTimeout(2000);
 const s=await page.evaluate(()=>{const s=(window as any).__game.state();return {faults:s.subsystemFaults,onFoot:s.nativeCar?.occupied??false};});
 expect(s.faults).toEqual([]);expect(s.onFoot).toBe(false);
 expect(errors).toEqual([]);
});
