import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** WARP_CHAR_INTO_CAR_AS_PASSENGER on the player (INTRO seats CJ in the back of Tenpenny's car): he rides in the
 * seat as the car goes, the script sees him in it, and the exit button sets him down beside it. */
test('the player rides a script car as a passenger and gets out beside it',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().vehicles.create(596,{x:p.x+6,y:-p.z+7,z:-100},0);});
 await page.waitForFunction(c=>!!(window as any).__game.missionForProfiling().vehicles.entity(c),car,{timeout:60000});
 await page.evaluate(c=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCarAsPassenger(1,c,2),car);
 const inside=await page.evaluate(c=>{const w=(window as any).__game.missionForProfiling().runtime.world;return {inCar:w.pedIsInCar?.(1,c),car:w.pedVehicle(1)};},car);
 expect(inside.car).toBe(car);
 // The script's car is asked for at z -100 (placed on the ground when it arrives): move it only once it stands there,
 // or it is carried on from below the world and falls, and the leave below waits for a car that never slows.
 await page.waitForFunction(c=>(window as any).__game.missionForProfiling().vehicles.positionOf(c).z>-50,car,{timeout:30000});
 // The car moves on (set down from a little above, so ground there that rises is not inside it); the player goes with it.
 const target=await page.evaluate(c=>{const m=(window as any).__game.missionForProfiling(),at=m.vehicles.positionOf(c);m.runtime.world.setVehicleCoordinates(c,at.x+25,at.y,at.z+1.5);return {x:at.x+25,y:at.y};},car);
 await expect.poll(async()=>{const p=await page.evaluate(()=>(window as any).__game.state().player.position);return Math.hypot(p.x-target.x,-p.z-target.y);},{timeout:15000}).toBeLessThan(4);
 await page.waitForTimeout(800);
 // CTaskSimpleCarWaitToSlowDown: the passenger gets out once the car has settled enough to step out of.
 await page.keyboard.press('KeyF');
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.pedVehicle(1)??null),{timeout:20000}).toBeNull();
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

/** IsRoomForPedToLeaveCar: a passenger whose own side of the car is walled off gets out on the other side. */
test('a passenger walled in on his side gets out on the other',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().vehicles.create(596,{x:p.x+6,y:-p.z+7,z:-100},0);});
 await page.waitForFunction(c=>!!(window as any).__game.missionForProfiling().vehicles.entity(c),car,{timeout:60000});
 await page.waitForFunction(c=>(window as any).__game.missionForProfiling().vehicles.positionOf(c).z>-50,car,{timeout:30000});
 // Rear left seat; a block stands where he would step out on the left.
 await page.evaluate(c=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCarAsPassenger(1,c,1),car);
 await page.waitForTimeout(1500);
 const blocked=await page.evaluate(async c=>{
  const dependencies='/tests/fixtures/native-render-dependencies.ts',{RAPIER}=await import(/* @vite-ignore */ dependencies);
  const g=(window as any).__game,v=g.missionForProfiling().vehicles.entity(c),b=v.assets.collision.bounds,half=Math.max(Math.abs(b.min[0]),Math.abs(b.max[0]))+.6;
  // Balls along the car's left flank (y runs along the car in its own frame), clear of its body.
  for(const y of [-1.5,-.75,0,.75,1.5]){const w=v.worldPoint({x:-half,y,z:0});g.sim.world.createCollider(RAPIER.ColliderDesc.ball(.5).setTranslation(w.x,w.y+.5,w.z));}
  const w=v.worldPoint({x:-half,y:0,z:0});return {x:w.x,z:w.z};
 },car);
 await page.keyboard.press('KeyF');
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.pedVehicle(1)??null),{timeout:20000}).toBeNull();
 const p=await page.evaluate(()=>(window as any).__game.state().player.position);
 // Out on the far side: well clear of the block.
 expect(Math.hypot(p.x-blocked.x,p.z-blocked.z)).toBeGreaterThan(2.5);
 expect(errors).toEqual([]);
});
