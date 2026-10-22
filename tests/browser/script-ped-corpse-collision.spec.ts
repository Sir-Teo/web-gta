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
 // A wall-clock delay can expire while the held death animation and low collider are still falling,
 // especially during terrain installation. Record the resting pose only after real animation/contact completion.
 await page.waitForFunction(h=>{const p=(window as any).__game.missionForProfiling().peds.entity(h);return p.view.reactionPlayedOut&&p.controller.computedGrounded();},ped,{timeout:30000});
 const lying=(await w('pedPosition',ped) as {z:number}).z;
 const sample=()=>page.evaluate(h=>{const g=(window as any).__game,p=g.missionForProfiling().peds.entity(h);return {position:{...p.actor.player.position},body:{...p.body.translation()},wait:p.collisionWait??null,grounded:p.actor.player.grounded,death:p.deathState,clip:p.view.reactionName,progress:p.view.reactionProgress};},ped);
 const before=await sample();
 // CJ goes back to Grove Street, five hundred units off: the window round him no longer holds the drive-thru.
 await w('setPedCoordinates',1,2495,-1687,-100);
 const samples=[];for(let i=0;i<10;i++){await page.waitForTimeout(1000);samples.push(await sample());}
 expect(Math.abs((await w('pedPosition',ped) as {z:number}).z-lying),JSON.stringify({before,samples})).toBeLessThan(.5);
 expect(errors).toEqual([]);
});
