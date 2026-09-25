import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** TASK_ENTER_CAR_AS_PASSENGER and TASK_ENTER_CAR_AS_DRIVER on a car the script made: the ped runs to the seat's door
 * and gets in, and the timed form sets a ped still on its way into the seat when its time runs out. */
test('script peds get into a script car as passenger and driver',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const made=await page.evaluate(()=>{
  const game=(window as any).__game,m=game.missionForProfiling(),p=game.state().player.position;
  // The car faces north (a heading of nothing), so its front passenger door is on the east, the rider's side.
  return {car:m.vehicles.create(400,{x:p.x+10,y:-p.z,z:p.y},0),rider:m.peds.create(4,'MALE01',{x:p.x+14,y:-p.z,z:p.y}),
   driver:m.peds.create(4,'MALE01',{x:p.x-25,y:-p.z,z:p.y})};
 });
 await page.waitForFunction(({car,rider,driver}:{car:number;rider:number;driver:number})=>{const m=(window as any).__game.missionForProfiling();return !!(m.vehicles.entity(car)&&m.peds.entity(rider)&&m.peds.entity(driver));},made,{timeout:45000});
 const PASSENGER=0x05ca,DRIVER=0x05cb;
 const status=(handle:number,opcode:number)=>page.evaluate(({handle,opcode})=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(handle,opcode),{handle,opcode});
 const ride=(handle:number)=>page.evaluate((handle:number)=>(window as any).__game.missionForProfiling().peds.rideOf(handle)??null,handle);
 await page.evaluate(({car,rider,driver,PASSENGER,DRIVER})=>{
  const w=(window as any).__game.missionForProfiling().runtime.world;
  w.givePedScriptedTask(rider,{kind:'enterCarAsPassenger',vehicle:car,time:-1,seat:0},PASSENGER);
  // 25 units off with half a second: the timed task sets it in.
  w.givePedScriptedTask(driver,{kind:'enterCarAsDriver',vehicle:car,time:500},DRIVER);
 },{...made,PASSENGER,DRIVER});
 await expect.poll(()=>ride(made.driver),{timeout:10000}).toEqual({vehicle:made.car,seat:'driver'});
 await expect.poll(()=>ride(made.rider),{timeout:30000}).toEqual({vehicle:made.car,seat:0});
 await expect.poll(()=>status(made.rider,PASSENGER),{timeout:10000}).toBe(7);
 await expect.poll(()=>status(made.driver,DRIVER),{timeout:10000}).toBe(7);
 // TASK_LEAVE_CAR and TASK_LEAVE_ANY_CAR: both are set down on foot beside the car, and the tasks end.
 const LEAVE=0x05cd,LEAVE_ANY=0x0633;
 await page.evaluate(({car,rider,driver,LEAVE,LEAVE_ANY})=>{
  const w=(window as any).__game.missionForProfiling().runtime.world;
  w.givePedScriptedTask(rider,{kind:'leaveCar',vehicle:car},LEAVE);w.givePedScriptedTask(driver,{kind:'leaveAnyCar'},LEAVE_ANY);
 },{...made,LEAVE,LEAVE_ANY});
 expect(await ride(made.rider)).toBe(null);expect(await ride(made.driver)).toBe(null);
 await page.waitForFunction(({rider,driver}:{rider:number;driver:number})=>{const m=(window as any).__game.missionForProfiling(),a=m.peds.entity(rider),b=m.peds.entity(driver);return !!(a?.actor&&b?.actor);},made,{timeout:30000});
 const beside=await page.evaluate(({car,rider,driver})=>{
  const m=(window as any).__game.missionForProfiling(),c=m.vehicles.positionOf(car);
  const d=(h:number)=>{const q=m.peds.positionOf(h);return Math.hypot(q.x-c.x,q.y-c.y);};
  return {rider:d(rider),driver:d(driver)};
 },made);
 expect(beside.rider).toBeLessThan(4);expect(beside.driver).toBeLessThan(4);
 expect(beside.rider).toBeGreaterThan(.8);expect(beside.driver).toBeGreaterThan(.8);
 await expect.poll(()=>status(made.rider,LEAVE),{timeout:10000}).toBe(7);
 expect(errors).toEqual([]);
});
