import {test,expect} from '@playwright/test';
/** TASK_CAR_DRIVE_TO_COORD: a script ped at the wheel of a script car drives it to the point on CCarAI's coordinate
 * mission, the car's mission clears inside 3 units, and the task is over. */
test('a script driver takes its car to a point',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 const made=await page.evaluate(()=>{
  const game=(window as any).__game,m=game.missionForProfiling(),p=game.state().player.position;
  const car=m.vehicles.create(400,{x:p.x+8,y:-p.z,z:p.y},90),driver=m.peds.create(4,'MALE01',{x:p.x+6,y:-p.z,z:p.y});
  return {car,driver};
 });
 await page.waitForFunction(({car,driver}:{car:number;driver:number})=>{const m=(window as any).__game.missionForProfiling();return !!(m.vehicles.entity(car)&&m.peds.entity(driver));},made,{timeout:45000});
 await page.evaluate(({car,driver})=>{(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCar(driver,car);},made);
 await page.waitForFunction(({driver}:{driver:number})=>!!(window as any).__game.missionForProfiling().peds.entity(driver)?.rider,made,{timeout:30000});
 const DRIVE=0x05d1;
 // Twelve units along the car's heading of 90 (west).
 const goal=await page.evaluate(({car,driver,opcode})=>{
  const m=(window as any).__game.missionForProfiling(),c=m.vehicles.positionOf(car),goal={x:c.x-12,y:c.y,z:c.z};
  m.runtime.world.givePedScriptedTask(driver,{kind:'carDriveToCoord',vehicle:car,...goal,speed:10,driveStyle:0,model:-1,drivingStyle:2},opcode);
  return goal;
 },{...made,opcode:DRIVE});
 const status=()=>page.evaluate(({driver,opcode})=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(driver,opcode),{driver:made.driver,opcode:DRIVE});
 await expect.poll(status,{timeout:5000}).toBe(1);
 await expect.poll(status,{timeout:60000}).toBe(7);
 const at=await page.evaluate(({car})=>(window as any).__game.missionForProfiling().vehicles.positionOf(car),made);
 expect(Math.hypot(at.x-goal.x,at.y-goal.y)).toBeLessThan(6);
 expect(errors).toEqual([]);
});
