import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** A script ped the script puts in the player's group (SWEET1's Sweet, later the Grove crews) follows the player on
 * foot, as CTaskComplexFollowLeaderInFormation, whenever the script has no task of its own on it; out of the group,
 * or with the group's default task set to stand still, it stays. */
test('a script ped in the player\'s group follows him, holds for a scripted task, and stays once let go',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const ped=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().peds.create(4,'MALE01',{x:p.x+3,y:-p.z,z:p.y});});
 await page.waitForFunction((h:number)=>!!(window as any).__game.missionForProfiling().peds.entity(h),ped,{timeout:45000});
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 const gap=()=>page.evaluate(h=>{const w=(window as any).__game.missionForProfiling().runtime.world,a=w.pedPosition(h),b=w.pedPosition(1);return Math.hypot(a.x-b.x,a.y-b.y);},ped);
 const group=await w('getPlayerGroup');
 await w('setGroupMember',group,ped);
 // The player moves 20 units along the street and back past his start: the ground the follower crosses is the
 // street it came along.
 const moveBy=(dx:number)=>page.evaluate(dx=>{const g=(window as any).__game,w=g.missionForProfiling().runtime.world,p=w.pedPosition(1);w.setPedCoordinates(1,p.x+dx,p.y,p.z);},dx);
 await moveBy(20);
 expect(await gap()).toBeGreaterThan(15);
 await expect.poll(gap,{timeout:30000}).toBeLessThan(5);
 // A scripted task holds it where it is.
 await w('givePedScriptedTask',ped,{kind:'standStill',time:60000},0x05ba);
 await moveBy(-40);
 await page.waitForTimeout(4000);
 expect(await gap()).toBeGreaterThan(15);
 // Out of the group, with its task cleared, it stays too.
 await w('removePedFromGroup',ped);
 await w('clearPedTasks',ped);
 await page.waitForTimeout(4000);
 expect(await gap()).toBeGreaterThan(15);
 // Back in the group, but with SET_GROUP_DEFAULT_TASK_ALLOCATOR's STAND_STILL, it does not follow either.
 await w('setGroupMember',group,ped);await w('setGroupDefaultTaskAllocator',group,2);
 await page.waitForTimeout(4000);
 expect(await gap()).toBeGreaterThan(15);
 await w('setGroupDefaultTaskAllocator',group,0);
 await expect.poll(gap,{timeout:30000}).toBeLessThan(5);
 expect(errors).toEqual([]);
});
