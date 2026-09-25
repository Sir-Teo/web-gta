import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** SET_CHAR_COORDINATES on the player: CRunningScript::SetCharCoordinates warps his gang with him (CPedGroup::Teleport),
 * as SWEET1B's walk to the crack den relies on; SET_CHAR_COORDINATES_DONT_WARP_GANG moves him alone. */
test('the player\'s gang is warped with him, except by the no-gang form',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 const start=await w('pedPosition',1);
 const ped=await page.evaluate(p=>(window as any).__game.missionForProfiling().peds.create(8,'FAM1',{x:p.x+3,y:p.y,z:p.z-1}),start);
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),ped,{timeout:60000});
 const group=await w('getPlayerGroup');await w('setGroupMember',group,ped);
 // Along Grove Street, inside the streamed window.
 const to={x:start.x-40,y:start.y+2,z:-100};
 await w('setPedCoordinates',1,to.x,to.y,to.z);
 const near=async()=>{const a=await w('pedPosition',1),b=await w('pedPosition',ped);return Math.hypot(a.x-b.x,a.y-b.y);};
 expect(await near()).toBeLessThan(4);
 await w('setPedCoordinatesDontWarpGang',1,start.x,start.y,-100);
 expect(await near()).toBeGreaterThan(30);
 expect(errors).toEqual([]);
});
