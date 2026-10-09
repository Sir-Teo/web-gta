import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

/** A script ped CJ leaves behind waits for its collision rather than falling through the map, dead or alive. SWEET3's
 * Ballas driver, shot at the drive-thru, sank under the map once CJ had driven off with the terrain window. */
test('a dead script ped lies where it fell while CJ is away',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 await w('setPedCoordinates',1,2411,-1925,-100);await page.waitForTimeout(6000);
 const at=await w('pedPosition',1) as {z:number};
 const ped=await w('createChar',25,103,2412,-1935,at.z) as number;
 await page.waitForFunction((h:number)=>(window as any).__game.missionForProfiling().peds.entity(h)!==undefined,ped,{timeout:60000});
 await page.waitForTimeout(1500);
 await w('setPedHealth',ped,0);
 await expect.poll(()=>w('pedIsDeadForScript',ped),{timeout:10000}).toBe(true);
 await page.waitForTimeout(2000);
 const lying=(await w('pedPosition',ped) as {z:number}).z;
 // CJ goes back to Grove Street, five hundred units off: the window round him no longer holds the drive-thru.
 await w('setPedCoordinates',1,2495,-1687,-100);
 await page.waitForTimeout(10000);
 expect(Math.abs((await w('pedPosition',ped) as {z:number}).z-lying)).toBeLessThan(.5);
 expect(errors).toEqual([]);
});
