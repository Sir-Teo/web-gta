import {test,expect} from '@playwright/test';

test('the script\'s driving and weapon skill stats are the skills the game keeps',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.missionForProfiling()?.runtime),{timeout:60000}).toBe(true);
 const read=await page.evaluate(()=>{
  const stats=(window as any).__game.missionForProfiling().runtime.game.stats;
  // SET_INT_STAT STAT_DRIVING_SKILL and SET_FLOAT_STAT STAT_PISTOL_SKILL, as the driving school and Ammu-Nation do.
  stats.set(160,120);stats.set(69,999);
  return {driving:stats.get(160)};
 });
 expect(read.driving).toBe(120);
 const s=await state();
 expect(s.progression.drivingSkill).toBe(120);
 // The weapon skill the game builds up is the stat the script reads.
 const pistol=await page.evaluate(()=>{const g=(window as any).__game,inventory=g.weapons().inventory;const before=inventory.practice.get(22);inventory.practice.set(28,640);return {before,uzi:g.missionForProfiling().runtime.game.stats.get(75)};});
 expect(pistol).toEqual({before:999,uzi:640});
 expect(errors).toEqual([]);
});
