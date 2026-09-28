import {test,expect} from '@playwright/test';
/** Targeting with a melee weapon: CTaskSimpleFight's stance (FIGHTIDLE), and the stick shuffles CJ on the FightSh
 * clips while he keeps facing where the camera looks. He moves by the shuffle's own root travel, not at a run. */
test('a targeted melee weapon holds the fight stance and shuffles sideways on the FightSh clips',async({page})=>{
 test.setTimeout(120000);await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:45000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await page.keyboard.press('Backquote');await page.locator('[data-weapon="5"]').click();
 await expect.poll(async()=>(await state()).weapons.ready).toBe(true);
 const probe=()=>page.evaluate(()=>{const g=(window as any).__game,st=g.state(),nc=g.render().nativeCharacter;
  return {action:nc.action,poses:nc.fightAnims?nc.fightAnims.poses().map((a:any)=>a.clip):[],heading:st.player.heading,position:{...st.player.position}};});
 await page.mouse.move(750,420);await page.mouse.down({button:'right'});
 await expect.poll(async()=>(await probe()).action).toBe('fightMove');
 const start=await probe();
 await page.keyboard.down('KeyD');
 await expect.poll(async()=>(await probe()).poses.at(-1),{timeout:5000}).toBe('right');
 await page.waitForTimeout(1500);
 const moved=await probe();await page.keyboard.up('KeyD');await page.mouse.up({button:'right'});
 const dx=moved.position.x-start.position.x,dz=moved.position.z-start.position.z,travel=Math.hypot(dx,dz);
 // CJ faces the camera's way; the shuffle carries him to his right, at a shuffle's pace (well under a run's 5.7).
 const right={x:-Math.cos(moved.heading),z:Math.sin(moved.heading)};
 expect(travel).toBeGreaterThan(.5);expect(travel/1.5).toBeLessThan(4);
 expect(Math.abs(dx*right.x+dz*right.z)/travel).toBeGreaterThan(.8);
 await expect.poll(async()=>(await probe()).action).not.toBe('fightMove');
});
