import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CCarGenerator leaves its parked cars STATUS_ABANDONED, and CAutomobile::ProcessAI's abandoned branch takes the
 * handbrake off (a 0.2 brake only once nearly still): a parked car shoved by a crash rolls on rather than skidding on
 * locked rear wheels. */
test('a shoved parked car rolls on with no handbrake',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await page.waitForFunction(()=>!!(window as any).__game.fleet()?.carById('starter'),undefined,{timeout:60000});
 await page.waitForTimeout(1000);
 const before=await page.evaluate(()=>{const car=(window as any).__game.fleet().carById('starter');return {handbrake:car.input.pedals.handbrake,abandoned:car.abandoned};});
 expect(before.abandoned).toBe(true);
 expect(before.handbrake).toBe(false);

 // A shove along its length at 6 m/s: rolling free it coasts about 3.6 m; on a locked rear axle it stops in about 1 m.
 const start=await page.evaluate(()=>{const car=(window as any).__game.fleet().carById('starter'),b=car.car.body,q=b.rotation();
  const fx=2*(q.x*q.z+q.w*q.y),fz=1-2*(q.x*q.x+q.y*q.y);const t=b.translation();b.setLinvel({x:fx*6,y:0,z:fz*6},true);return {x:t.x,z:t.z};});
 await expect.poll(()=>page.evaluate(()=>{const v=(window as any).__game.fleet().carById('starter').car.body.linvel();return Math.hypot(v.x,v.z);}),{timeout:30000}).toBeLessThan(.2);
 const moved=await page.evaluate(s=>{const t=(window as any).__game.fleet().carById('starter').car.body.translation();return Math.hypot(t.x-s.x,t.z-s.z);},start);
 expect(moved).toBeGreaterThan(2.5);
 expect(errors).toEqual([]);
});
