import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** TASK_DRIVE_BY (INTRO1's Ballas): a script ped riding in a script car leans out with the drive-by clip and fires
 * the Micro SMG at a point; a car target takes the rounds; CLEAR_CHAR_TASKS ends it. A ped target the script deletes
 * is no target any more, not a fault every frame (SWEET4 deleted its Ballas under Sweet's drive-by). */
test('a script rider fires a drive-by at a point and at a car',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const made=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position,m=g.missionForProfiling();
  return {car:m.vehicles.create(596,{x:p.x+8,y:-p.z+8,z:-100},0),target:m.vehicles.create(596,{x:p.x+8,y:-p.z+22,z:-100},0),at:{x:p.x+8,y:-p.z+8}};});
 for(const h of [made.car,made.target])await page.waitForFunction(c=>!!(window as any).__game.missionForProfiling().vehicles.entity(c),h,{timeout:60000});
 const rider=await page.evaluate(c=>(window as any).__game.missionForProfiling().peds.createInCar(7,'MALE01',c,0),made.car);
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),rider,{timeout:60000});
 const DRIVE_BY=0x0713;
 await page.evaluate(({h,t,op})=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.givePedScriptedTask(h,{kind:'driveBy',targetPed:-1,targetVehicle:t,x:0,y:0,z:0,radius:100,type:0,rightHandCarSeat:true,fireRate:100},op);},{h:rider,t:made.target,op:DRIVE_BY});
 const health=()=>page.evaluate(t=>(window as any).__game.missionForProfiling().vehicles.entity(t).health,made.target);
 const before=await health();
 await expect.poll(health,{timeout:60000}).toBeLessThan(before);
 const leaning=await page.evaluate(h=>!!(window as any).__game.missionForProfiling().peds.entity(h).driveBy,rider);
 expect(leaning).toBe(true);
 await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.clearPedTasks(h),rider);
 expect(await page.evaluate(h=>!!(window as any).__game.missionForProfiling().peds.entity(h).driveBy,rider)).toBe(false);
 const faults:string[]=[];page.on('console',m=>{if(m.type()==='error'&&m.text().includes('scriptDriveBys'))faults.push(m.text());});
 const victim=await page.evaluate(({x,y})=>(window as any).__game.missionForProfiling().peds.create(4,'MALE01',{x:x+20,y,z:-100}),made.at);
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),victim,{timeout:60000});
 await page.evaluate(({h,t,op})=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(h,{kind:'driveBy',targetPed:t,targetVehicle:-1,x:0,y:0,z:0,radius:100,type:0,rightHandCarSeat:true,fireRate:100},op),{h:rider,t:victim,op:DRIVE_BY});
 await page.evaluate(t=>(window as any).__game.missionForProfiling().runtime.world.deletePed(t),victim);
 await page.waitForTimeout(1500);
 expect(faults).toEqual([]);
 expect(errors).toEqual([]);
});
