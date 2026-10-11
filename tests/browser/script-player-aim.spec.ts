import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** TASK_AIM_GUN_AT_COORD on the player: CAT2 freezes CJ at the counter with his controls off and has him hold the shotgun
 * on the clerk for ten seconds. The player's tasks had no aim, and the mission gave up there. */
test('a script holds the player\'s gun on a point for its time, then lets it down',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 await page.evaluate(()=>{
  const g=(window as any).__game,w=g.missionForProfiling().runtime.world,p=g.state().player.position;
  const inv=g.weapons().inventory;inv.give(25,48);inv.select(25);
  w.setPlayerControl(0,false);
  // Six east and six north of him, at chest height (native axes).
  const at={x:p.x+6,y:-p.z+6,z:p.y+1.4};
  w.givePedScriptedTask(1,{kind:'aimGunAtCoord',x:at.x,y:at.y,z:at.z,time:2000},0x0667);
 });
 // The renderer's targetHeld is the frame's weapons.aiming.
 const aiming=()=>page.evaluate(()=>(window as any).__game.render().targetHeld as boolean);
 await expect.poll(aiming,{timeout:3000}).toBe(true);
 // Turned to face it: north-east is the renderer's (+x, -z), a heading of atan2(1, -1).
 await expect.poll(()=>page.evaluate(()=>{const h=(window as any).__game.state().player.heading,d=h-Math.atan2(1,-1);return Math.abs(Math.atan2(Math.sin(d),Math.cos(d)));}),{timeout:3000}).toBeLessThan(.15);
 // Its two seconds over, the gun comes down.
 await expect.poll(aiming,{timeout:5000}).toBe(false);
 expect(errors).toEqual([]);
});
