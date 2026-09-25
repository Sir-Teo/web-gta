import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** A street car the player takes has a handle of its own once a script asks (CPools gives every vehicle one), which
 * goes on naming it after he gets out. The script's peds in his group get in with him as passengers and out after
 * him (CGroupEventHandler's leader entered and exited car responses). */
test('the player\'s street car gets a handle, and his group\'s script peds ride in it with him',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 const ped=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().peds.create(4,'MALE01',{x:p.x+2,y:-p.z+2,z:p.y});});
 await page.waitForFunction((h:number)=>!!(window as any).__game.missionForProfiling().peds.entity(h),ped,{timeout:45000});
 await w('setGroupMember',await w('getPlayerGroup'),ped);
 const spawned=await page.evaluate(async()=>{const g=(window as any).__game,p=g.sim.player,car=await g.fleet().spawnCheatVehicle(426,p.position,p.heading);if(!car)return false;g.carEntry().enter(car);return true;});
 expect(spawned).toBe(true);
 await expect.poll(()=>w('pedVehicle',1),{timeout:90000}).not.toBeUndefined();
 const car=await w('pedVehicle',1) as number;
 expect(car).not.toBe(1);
 expect(await w('vehicleModel',car)).toBe(426);
 // The follower gets in beside him.
 await expect.poll(()=>w('pedVehicle',ped),{timeout:90000}).toBe(car);
 expect(await w('scriptTaskStatus',ped,-1)).toBe(7);
 // Set down beside the car while he stays in it (a crash, or the script), it climbs back in: its default task,
 // CTaskComplexFollowLeaderAnyMeans, boards the leader's car whenever he sits in one.
 await w('warpPedFromCarToCoord',ped,...Object.values(await page.evaluate(()=>{const p=(window as any).__game.state().player.position;return {x:p.x+3,y:-p.z,z:-100};})));
 expect(await w('pedVehicle',ped)).toBeUndefined();
 await expect.poll(()=>w('pedVehicle',ped),{timeout:90000}).toBe(car);
 // He gets out; the follower follows him out, and the handle still names the car.
 await w('givePedScriptedTask',1,{kind:'leaveCar',vehicle:car},0x0622);
 await expect.poll(()=>w('pedVehicle',1),{timeout:60000}).toBeUndefined();
 await expect.poll(()=>w('pedVehicle',ped),{timeout:60000}).toBeUndefined();
 expect(await w('vehicleExists',car)).toBe(true);
 expect(await w('vehicleModel',car)).toBe(426);
 expect(errors).toEqual([]);
});
