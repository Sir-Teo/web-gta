import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CTaskSimplePlayerOnFire::ProcessPed puts the player's fire out once its 5000 ms timer runs out, whatever the fire's
 * own burn time: a fire that merges with nearby ones and would burn on (7000 ms a merge) still leaves CJ after five. */
test('a fire on CJ goes out after five seconds',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 const start=await page.evaluate(()=>{const g=(window as any).__game,w=g.weapons(),s=g.sim,p=s.player.position;s.player.health=100000;
  w.fires.startFireOn({kind:'player',key:'player'},{x:p.x,y:-p.z,z:p.y},60000,0,{nowMs:w.nowMs,random:Math.random});
  // CFire::ProcessFire's merge with nearby fires pushes m_TimeToBurn past the player's own 2333 ms (+7000 each time).
  w.fires.fireOn('player').timeToBurn=w.nowMs+60000;return w.nowMs;});
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.weapons().fires.fireOn('player')),{timeout:60000}).toBe(false);
 const burned=await page.evaluate(s=>(window as any).__game.weapons().nowMs-s,start);
 expect(burned).toBeGreaterThanOrEqual(4900);
 expect(burned).toBeLessThan(6000);
 expect(errors).toEqual([]);
});
