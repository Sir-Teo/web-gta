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
 // TASK_CAR_TEMP_ACTION 6 (TEMPACT_HANDBRAKESTRAIGHT) for a second: running, then over.
 const TEMP=0x06c7,WANDER=0x05d2;
 const temp=()=>page.evaluate(({driver,opcode})=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(driver,opcode),{driver:made.driver,opcode:TEMP});
 await page.evaluate(({car,driver,opcode})=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(driver,{kind:'carTempAction',vehicle:car,actionId:6,time:1000},opcode),{...made,opcode:TEMP});
 await expect.poll(temp,{timeout:5000}).toBe(1);
 await expect.poll(temp,{timeout:10000}).toBe(7);
 // TASK_CAR_DRIVE_WANDER: the car drives off along the roads and the task keeps running.
 await page.evaluate(({car,driver,opcode})=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(driver,{kind:'carDriveWander',vehicle:car,speed:10,drivingMode:2},opcode),{...made,opcode:WANDER});
 const wanderFrom=await page.evaluate(({car})=>(window as any).__game.missionForProfiling().vehicles.positionOf(car),made);
 await expect.poll(async()=>{const q=await page.evaluate(({car})=>(window as any).__game.missionForProfiling().vehicles.positionOf(car),made);return Math.hypot(q.x-wanderFrom.x,q.y-wanderFrom.y);},{timeout:30000}).toBeGreaterThan(8);
 expect(await page.evaluate(({driver,opcode})=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(driver,opcode),{driver:made.driver,opcode:WANDER})).toBe(1);
 // POINT_CAMERA_AT_CAR in fixed mode: the camera stays where SET_FIXED_CAMERA_POSITION put it and looks at the car.
 const camera=await page.evaluate(({car})=>{
  const m=(window as any).__game.missionForProfiling(),w=m.runtime.world,c=m.vehicles.positionOf(car);
  m.runtime.game.camera.setCamPositionForFixedMode({x:c.x+10,y:c.y,z:c.z+5},{x:0,y:0,z:0});
  w.pointCameraAtVehicle(car,15,2);const cam=m.scriptCamera(),now=m.vehicles.positionOf(car);
  return {target:cam?.target,car:{x:now.x,y:now.z,z:-now.y},position:cam?.position};
 },made);
 expect(camera.target.x).toBeCloseTo(camera.car.x,1);expect(camera.target.z).toBeCloseTo(camera.car.z,1);
 // MARK_CAR_AS_NO_LONGER_NEEDED: the car is a random one again, unlocked and off the script's mission.
 const released=await page.evaluate(({car})=>{
  const m=(window as any).__game.missionForProfiling(),e=m.vehicles.entity(car);
  m.runtime.world.restoreCamera?.();m.runtime.world.markVehicleNoLongerNeeded(car);return {mission:e.missionCar,locked:e.locked,autopilot:e.autopilot??null};
 },made);
 expect(released).toEqual({mission:false,locked:false,autopilot:null});
 expect(errors).toEqual([]);
});
