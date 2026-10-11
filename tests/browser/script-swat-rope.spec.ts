import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CREATE_SWAT_ROPE (iOS 0x1001e3ff4): a SWAT ped made at the rope's top slides down CTaskComplexUseSwatRope's rope,
 * 0.003 of its 20 units a frame, and the task (the command's own, for GET_SCRIPT_TASK_STATUS) ends within 2 of the
 * ground, where he lets go. DRUGS4 waits on that status before sending each one on. */
test('a SWAT comes down his rope and lets go near the ground, his task then finished',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 const made=await page.evaluate(()=>{
  const g=(window as any).__game,w=g.missionForProfiling().runtime.world,p=g.state().player.position;
  const ground=g.groundAt(p.x+4,p.z,p.y+5);
  const top={x:p.x+4,y:-p.z,z:ground+9};
  return {handle:w.createSwatRope(6,285,top.x,top.y,top.z),top,ground};
 });
 const status=()=>page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(h,0x0503),made.handle);
 const z=()=>page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.pedPosition(h).z,made.handle);
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),made.handle,{timeout:45000});
 // On the rope: running, high up and coming down.
 await expect.poll(z,{timeout:5000}).toBeGreaterThan(made.ground+4);
 expect(await status()).not.toBe(7);
 const first=await z();await page.waitForTimeout(600);
 expect(await z()).toBeLessThan(first-.5);
 // Down and finished, standing on the ground under the rope.
 await expect.poll(status,{timeout:15000}).toBe(7);
 await expect.poll(async()=>Math.abs(await z()-(made.ground+1)),{timeout:10000}).toBeLessThan(.5);
 const p=await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.pedPosition(h),made.handle);
 expect(Math.hypot(p.x-made.top.x,p.y-made.top.y)).toBeLessThan(1);
 expect(errors).toEqual([]);
});
