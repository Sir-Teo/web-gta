import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CTaskSimpleFall refuses damage that leaves the ped alive, but CTaskSimpleGetUp::MakeAbortable gives way to it once
 * the get-up clip plays: a gunshot as CJ rises ends the get-up and he reacts to it afresh, where a shot while he still
 * lies there changes nothing. */
test('a shot while CJ gets up gets its own reaction; one while he lies there does not',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().pedestrians?.people?.length??0),{timeout:60000}).toBeGreaterThan(0);
 const shoot=()=>page.evaluate(()=>{const s=(window as any).__game.sim,p=s.player.position,h=s.player.heading;s.damagePlayer(5,true,{weapon:22,from:{x:p.x+Math.sin(h)*5,z:p.z+Math.cos(h)*5}});});
 const state=()=>page.evaluate(()=>{const s=(window as any).__game.state();return {reaction:s.nativeCharacter?.reaction??'',knockdown:s.knockdown,health:s.player.health};});
 // Floor him with a blast's throw (a fall event from the front).
 await page.evaluate(()=>{const s=(window as any).__game.sim,p=s.player.position;s.damagePlayer(5,true,{weapon:51,from:{x:p.x,z:p.z+3},fall:true});});
 await expect.poll(async()=>(await state()).knockdown,{timeout:10000}).toBeGreaterThan(0);
 const lying=(await state()).reaction;
 await shoot();await page.waitForTimeout(200);
 expect((await state()).reaction).toBe(lying);
 await expect.poll(async()=>(await state()).reaction,{timeout:30000}).toMatch(/^getup/);
 // Every frame's reaction after the shot: a hit clip is short against the headless frame rate.
 const seen=await page.evaluate(()=>new Promise<string[]>(resolve=>{const g=(window as any).__game,s=g.sim,p=s.player.position,h=s.player.heading,out:string[]=[];
  s.damagePlayer(5,true,{weapon:22,from:{x:p.x+Math.sin(h)*5,z:p.z+Math.cos(h)*5}});
  const t=performance.now(),f=()=>{out.push(g.state().nativeCharacter?.reaction??'');if(performance.now()-t<3000)requestAnimationFrame(f);else resolve(out);};requestAnimationFrame(f);}));
 expect(seen.some(r=>/^(hit_|shot_)/.test(r))).toBe(true);
 expect(seen.some(r=>/^getup/.test(r))).toBe(false);
 expect(errors).toEqual([]);
});
