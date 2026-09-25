import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** SET_CHAR_COORDINATES on the player to a place whose terrain is not streamed yet (INTRO2 and every mission warp):
 * the player waits where the script put him until the window comes in, and then stands on the ground there, rather
 * than falling for the jump allowance first and landing below it. */
test('a script teleport far away holds the player until the ground is in, and he stands on it',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 // In front of the Idlewood barber's, 430 units from Grove Street, at the door's step (12.66).
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.setPedCoordinates(1,2074,-1793.9,12.66));
 const player=()=>page.evaluate(()=>{const s=(window as any).__game.state();return {y:s.player.position.y,grounded:s.player.grounded,hold:s.terrainHold};});
 // Held where it was put while the window is on its way.
 expect((await player()).hold).toBe(true);expect((await player()).y).toBeCloseTo(12.66,2);
 const ground=()=>page.evaluate(()=>(window as any).__game.groundAt(2074,1793.9,20));
 await expect.poll(async()=>(await player()).hold===false&&(await ground())!==null,{timeout:200000,intervals:[1000]}).toBe(true);
 await page.waitForTimeout(3000);
 // On the ground under the point, not under it.
 const landed=await player(),under=await ground();
 expect(landed.grounded).toBe(true);expect(under).toBeGreaterThan(11.5);expect(Math.abs(landed.y-under)).toBeLessThan(.3);
 expect(errors).toEqual([]);
});
