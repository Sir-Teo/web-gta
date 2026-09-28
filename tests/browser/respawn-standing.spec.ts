import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** RestorePlayerStuffDuringResurrection teleports the ped's origin (a unit above its feet) to the restart point plus one:
 * CJ's feet start at the hospital's restart point, and CStreaming holds him while the collision there loads. He used to
 * appear a metre up and drop, landing in FALL_COLLAPSE whenever the streaming hold caught him mid-fall. */
test('Wasted puts CJ on his feet at the hospital, not a metre above it',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await page.evaluate(()=>{(window as any).__game.sim.player.health=0;});
 const sample=()=>page.evaluate(()=>{const s=(window as any).__game.state();return {h:s.player.health,g:s.player.grounded,x:s.player.position.x,y:s.player.position.y};});
 let first:{y:number}|undefined;
 await expect.poll(async()=>{const s=await sample();const there=s.h>0&&Math.abs(s.x-2495)>50;if(there&&!first)first=s;return there&&s.g;},{timeout:120000,intervals:[50]}).toBe(true);
 await page.waitForTimeout(1000);
 const standing=await sample();
 expect(Math.abs(first!.y-standing.y)).toBeLessThan(.25);
 expect(errors).toEqual([]);
});
