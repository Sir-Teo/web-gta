import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CTaskSimpleJump, CTaskSimpleInAir and CTaskSimpleLand refuse an urgent abort: a blow that would floor CJ on the
 * ground (a car's ram) lands its damage mid-jump but neither floors nor flinches him. */
test('a knockdown blow mid-jump hurts CJ without flooring him',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>{const s=(window as any).__game.state();return {grounded:s.player.grounded,health:s.player.health,knockdown:s.knockdown,reaction:s.nativeCharacter?.reaction};});
 await expect.poll(async()=>(await state()).grounded,{timeout:60000}).toBe(true);
 // A new game's starting loadout gives full armour, which would take the blow; it is health this is about.
 await page.evaluate(()=>{(window as any).__game.sim.player.armour=0;});
 // The blow lands while the jump's task runs (a press a slow frame misses is pressed again).
 let hit=false;
 for(let i=0;i<20&&!hit;i++){
  await page.keyboard.press('Space');await page.waitForTimeout(100);
  hit=await page.evaluate(()=>{const g=(window as any).__game;if(!g.sim.playerInAirTask?.())return false;const p=g.sim.player.position;g.sim.damagePlayer(10,false,{weapon:49,from:{x:p.x,z:p.z+2},fall:true});return true;});
 }
 expect(hit).toBe(true);
 await page.waitForTimeout(300);
 const after=await state();
 expect(after.health).toBeLessThan(100);expect(after.knockdown).toBe(0);expect(after.reaction??null).toBeNull();
 expect(errors).toEqual([]);
});
