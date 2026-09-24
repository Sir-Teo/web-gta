import {test,expect} from '@playwright/test';
/** A wrecked bike hands its BlowUpCar to the weapon system from afterStep; the loop must read that once. */
test('a bike that blows up sets off its explosion',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await page.waitForFunction(()=>!!(window as any).__game.fleet(),undefined,{timeout:60000});
 const spawned=await page.evaluate(async()=>{const g=(window as any).__game,p=g.state().player;return !!await g.fleet().spawnCheatVehicle(522,p.position,p.heading);});
 expect(spawned).toBe(true);
 await page.waitForTimeout(500);
 expect(await page.evaluate(()=>(window as any).__game.fx().snapshot().active.some((n:string)=>n.startsWith('explosion')))).toBe(false);
 await page.evaluate(()=>{for(const bike of (window as any).__game.fleet().bikes)bike.blowUp();});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.fx().snapshot().active.filter((n:string)=>n.startsWith('explosion'))),{timeout:5000}).not.toEqual([]);
 expect(errors).toEqual([]);
});
