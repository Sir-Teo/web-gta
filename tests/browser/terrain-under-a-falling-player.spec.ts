import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** A player dropped over ground that is not streamed in (a parachutist far from any window, or a dev teleport) used
 * to fall out of the world: the follower asked for nothing while he was airborne, and a window that did arrive was
 * deferred until he landed on nothing. The falling player now gets his window and lands on it. */
test('a player falling over unstreamed ground gets its terrain and lands',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await page.waitForFunction(()=>(window as any).__game?.state().player.grounded);
 // Free roam: the opening mission, left running, would put him back in Los Santos for its next scene.
 await page.waitForFunction(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started,undefined,{timeout:60000});
 await endStoryMission(page);
 await page.waitForFunction(()=>{const s=(window as any).__game.state();return s.following.requests>=1&&s.following.pending===null;},null,{timeout:30000}).catch(()=>{});
 // Downtown San Fierro, 120 m up, more than 4 km from the loaded window.
 await page.evaluate(()=>(window as any).__game.placePlayer(-2000,120,-300));
 // The boundary hold may freeze him before a step clears his grounded flag; what matters is where he ends up:
 // on the streamed window well below the drop height, not on the world floor.
 await expect.poll(()=>page.evaluate(()=>{const s=(window as any).__game.state();return s.player.grounded&&s.player.position.y<100&&s.player.position.x<-1900&&!s.terrainHold;}),{timeout:60000}).toBe(true);
 const s=await page.evaluate(()=>{const s=(window as any).__game.state();return {pos:s.player.position,requests:s.following.requests,failures:s.following.failures,holds:s.following.holds,instances:s.importedInstances};});
 console.log(JSON.stringify({...s,errors}));
 expect(errors).toEqual([]);expect(s.failures).toBe(0);expect(s.pos.y).toBeGreaterThan(-50);expect(s.instances).toBeGreaterThan(0);
});
