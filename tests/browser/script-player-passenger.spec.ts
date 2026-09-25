import {test,expect} from '@playwright/test';
/** WARP_CHAR_INTO_CAR_AS_PASSENGER on the player (INTRO seats CJ in the back of Tenpenny's car): he rides in the
 * seat as the car goes, the script sees him in it, and the exit button sets him down beside it. */
test('the player rides a script car as a passenger and gets out beside it',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().vehicles.create(596,{x:p.x+6,y:-p.z+7,z:-100},0);});
 await page.waitForFunction(c=>!!(window as any).__game.missionForProfiling().vehicles.entity(c),car,{timeout:60000});
 await page.evaluate(c=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCarAsPassenger(1,c,2),car);
 const inside=await page.evaluate(c=>{const w=(window as any).__game.missionForProfiling().runtime.world;return {inCar:w.pedIsInCar?.(1,c),car:w.pedVehicle(1)};},car);
 expect(inside.car).toBe(car);
 // The car moves on; the player goes with it.
 const target=await page.evaluate(c=>{const m=(window as any).__game.missionForProfiling(),at=m.vehicles.positionOf(c);m.runtime.world.setVehicleCoordinates(c,at.x+25,at.y,at.z);return {x:at.x+25,y:at.y};},car);
 await expect.poll(async()=>{const p=await page.evaluate(()=>(window as any).__game.state().player.position);return Math.hypot(p.x-target.x,-p.z-target.y);},{timeout:15000}).toBeLessThan(4);
 await page.waitForTimeout(800);
 await page.keyboard.press('KeyF');
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.pedVehicle(1)??null),{timeout:10000}).toBeNull();
 const out=await page.evaluate(c=>{const g=(window as any).__game,p=g.state().player.position,at=g.missionForProfiling().vehicles.positionOf(c);return {d:Math.hypot(p.x-at.x,-p.z-at.y),grounded:g.state().player.grounded};},car);
 expect(out.d).toBeLessThan(5);expect(out.d).toBeGreaterThan(1);
 expect(errors).toEqual([]);
});

/** INTRO's end of the ride: TASK_LEAVE_CAR_IMMEDIATELY takes CJ out of his passenger seat, and a car deleted with
 * him still in it (CPed::FlagToDestroyWhenNextProcessed clears the player's vehicle) leaves him where he sat. */
test('the leave task and a deleted car both put the passenger on foot',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 const make=()=>page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().vehicles.create(596,{x:p.x+6,y:-p.z+7,z:-100},0);});
 const seat=async(car:number)=>{
  await page.waitForFunction(c=>!!(window as any).__game.missionForProfiling().vehicles.entity(c),car,{timeout:60000});
  await page.evaluate(c=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCarAsPassenger(1,c,2),car);
  expect(await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.pedVehicle(1))).toBe(car);
 };
 const first=await make();await seat(first);
 await page.evaluate(c=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(1,{kind:'leaveCarImmediately',vehicle:c},0x0622),first);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.pedVehicle(1)??null),{timeout:10000}).toBeNull();
 const second=await make();await seat(second);
 const before=await page.evaluate(()=>(window as any).__game.state().player.position);
 await page.evaluate(c=>(window as any).__game.missionForProfiling().runtime.world.deleteVehicle(c),second);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.pedVehicle(1)??null),{timeout:10000}).toBeNull();
 await page.waitForTimeout(1500);
 const after=await page.evaluate(()=>(window as any).__game.state().player);
 expect(Math.hypot(after.position.x-before.x,after.position.z-before.z)).toBeLessThan(2);
 expect(errors).toEqual([]);
});
