import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CEventDamage::ComputeDamageAnim sets no animation for a ped in a vehicle: CJ shot on a bike takes the damage but
 * plays no on-foot flinch and is not floored while he stays on it. */
test('a shot rider plays no on-foot reaction',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().pedestrians?.people?.length??0),{timeout:60000}).toBeGreaterThan(0);
 await page.evaluate(()=>(window as any).__game.spawnVehicle(522));
 await expect.poll(()=>page.evaluate(()=>((window as any).__game.fleet().bikes?.size??[...(window as any).__game.fleet().bikes].length)>0),{timeout:30000}).toBe(true);
 await page.waitForTimeout(1000);
 await page.keyboard.press('KeyF');
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.fleet().occupiedBike),{timeout:60000}).toBe(true);
 await page.waitForTimeout(500);
 const seen=await page.evaluate(()=>new Promise<{reactions:string[];knockdown:number;health:number;riding:boolean}>(resolve=>{const g=(window as any).__game,s=g.sim,p=s.player.position,h=s.player.heading,out:string[]=[];
  s.damagePlayer(10,true,{weapon:22,from:{x:p.x+Math.sin(h)*5,z:p.z+Math.cos(h)*5}});let knock=0;
  const t=performance.now(),f=()=>{out.push(g.state().nativeCharacter?.reaction??'');knock=Math.max(knock,s.knockdown);if(performance.now()-t<2500)requestAnimationFrame(f);else resolve({reactions:out,knockdown:knock,health:s.player.health,riding:!!g.fleet().occupiedBike});};requestAnimationFrame(f);}));
 expect(seen.health).toBeLessThan(100);
 expect(seen.riding).toBe(true);
 expect(seen.reactions.some(r=>/^(hit_|shot_|ko_|kd_)/.test(r))).toBe(false);
 expect(seen.knockdown).toBe(0);
 expect(errors).toEqual([]);
});
