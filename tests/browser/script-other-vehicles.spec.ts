import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CREATE_CAR for a bike, a boat and a helicopter: each is built through its own class and answers the car commands
 * (position, heading, health, deletion). The sweep's WUZI5, SYN6 and KICKSTA had stopped on vehicles never made. */
test('a script can make a bike, a boat and a helicopter',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const handles=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position,m=g.missionForProfiling();
  return [461,452,487].map((id,k)=>m.vehicles.create(id,{x:p.x+8+k*12,y:-p.z+10,z:-100},90));});
 for(const h of handles)await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),h,{timeout:60000});
 const read=await page.evaluate(hs=>{const m=(window as any).__game.missionForProfiling(),w=m.runtime.world;
  return hs.map((h:number)=>({exists:w.vehicleExists(h),heading:w.vehicleHeading(h),health:w.vehicleHealth?.(h),at:m.vehicles.positionOf(h),train:w.vehicleIsTrain(h)}));},handles);
 for(const r of read){expect(r.exists).toBe(true);expect(Math.abs(((r.heading-90)%360+540)%360-180)).toBeLessThan(5);expect(r.train).toBe(false);}
 await page.evaluate(hs=>{const w=(window as any).__game.missionForProfiling().runtime.world;for(const h of hs)w.deleteVehicle(h);},handles);
 expect(await page.evaluate(hs=>hs.map((h:number)=>(window as any).__game.missionForProfiling().vehicles.exists(h)),handles)).toEqual([false,false,false]);
 expect(errors).toEqual([]);
});

/** WARP_CHAR_INTO_CAR onto a script BMX, as INTRO's probe does for the ride to Grove Street: the player is seated at
 * once and IS_CHAR_IN_CAR against the bike's handle holds. */
test('the player warps onto a script bike and the script sees him on it',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 const bike=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().vehicles.create(481,{x:p.x+5,y:-p.z+5,z:-100},0);});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),bike,{timeout:60000});
 await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCar(1,h),bike);
 const seen=await page.evaluate(h=>{const w=(window as any).__game.missionForProfiling().runtime.world;return {vehicle:w.pedVehicle(1),model:w.pedVehicleModelId(1),police:w.pedVehicleIsLawEnforcement(1)};},bike);
 // R3 asks IS_CHAR_IN_ANY_POLICE_VEHICLE of him on it: a BMX is no law enforcement vehicle.
 expect(seen).toEqual({vehicle:bike,model:481,police:false});
 expect(errors).toEqual([]);
});
