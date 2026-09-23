import {test,expect} from '@playwright/test';
/** CObject::TryToExplode and Explode: a causes-explosion prop (the Idlewood gas station's washgaspump) blows up once, and
 * CObject::ProcessControl then hides it on a 1-in-32 roll each step. */
test('a petrol pump blows up once and is gone moments later',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await page.evaluate(()=>(window as any).__game.placePlayer(1938,20,1776));await page.waitForTimeout(1000);await page.waitForFunction(()=>(window as any).__game.state().player.grounded===true,undefined,{timeout:90000});
 const pumps=()=>page.evaluate(()=>(window as any).__game.propsNamed('^washgaspump'));
 await expect.poll(async()=>(await pumps()).filter((p:any)=>p.present).length,{timeout:90000}).toBeGreaterThan(0);
 const pump=(await pumps()).find((p:any)=>p.present);
 expect(await page.evaluate(h=>(window as any).__game.explodeProp(h),pump.handle)).toBe(true);
 // Once only: bIsExploded.
 expect(await page.evaluate(h=>(window as any).__game.explodeProp(h),pump.handle)).toBe(false);
 await expect.poll(async()=>(await pumps()).find((p:any)=>p.handle===pump.handle)?.present??false,{timeout:15000}).toBe(false);
 expect(errors).toEqual([]);
});
