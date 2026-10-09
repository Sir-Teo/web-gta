import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('CJ swims the breaststroke at 50/30 of its clip speed, as the 30 fps game does',async({page})=>{
 test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await endStoryMission(page);
 // Open water off the Los Santos docks.
 await page.evaluate(()=>(window as any).__game.placePlayer(2600,2,2600));
 await expect.poll(async()=>(await state()).player.swimming,{timeout:60000}).toBe(true);
 await page.waitForTimeout(1500);
 await page.keyboard.down('KeyW');await page.waitForTimeout(3000);
 const a=await page.evaluate(()=>{const g=(window as any).__game;return {p:{...g.state().player.position},t:g.gameTimeMs(),s:g.state().player.swimState};});
 await page.waitForTimeout(2000);
 const b=await page.evaluate(()=>{const g=(window as any).__game;return {p:{...g.state().player.position},t:g.gameTimeMs()};});
 await page.keyboard.up('KeyW');
 const speed=Math.hypot(b.p.x-a.p.x,b.p.z-a.p.z)/((b.t-a.t)/1000);
 // SWIM_BREAST's 2.316 units a second × 50/30 ≈ 3.86 (game time, so the page's load does not matter).
 expect(a.s,JSON.stringify({a,b})).toBe(1);expect(speed).toBeGreaterThan(3.3);expect(speed).toBeLessThan(4.4);
 expect(errors).toEqual([]);
});
