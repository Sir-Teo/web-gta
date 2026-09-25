import {test,expect} from '@playwright/test';
/** A sequence with car tasks in it (CTaskComplexSequence): a ped on foot told to drive gets in at the wheel first
 * (CTaskComplexCarDrive), drives to the point, waits in its seat, gets out once the car is still and turns on foot.
 * GET_SEQUENCE_PROGRESS reads the task it is on, and -1 once the sequence is over. */
test('a script ped runs a sequence that drives, waits, gets out and turns',async({page})=>{
 test.setTimeout(300000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 const made=await page.evaluate(()=>{
  const game=(window as any).__game,m=game.missionForProfiling(),p=game.state().player.position;
  const car=m.vehicles.create(400,{x:p.x+8,y:-p.z,z:p.y},90),driver=m.peds.create(4,'MALE01',{x:p.x+6,y:-p.z+3,z:p.y});
  return {car,driver};
 });
 await page.waitForFunction(({car,driver}:{car:number;driver:number})=>{const m=(window as any).__game.missionForProfiling();return !!(m.vehicles.entity(car)&&m.peds.entity(driver));},made,{timeout:45000});
 const PERFORM=0x0618;
 const plan=await page.evaluate(({car,driver,opcode})=>{
  const m=(window as any).__game.missionForProfiling(),c=m.vehicles.positionOf(car);
  // Twelve units along the car's heading of 90 (west). Script peds do not walk round a car in their way
  // (CTaskComplexWalkRoundCar), so the last task is a turn rather than a walk.
  const drive={x:c.x-12,y:c.y,z:c.z};
  m.runtime.world.givePedSequence(driver,[
   {kind:'carDriveToCoord',vehicle:car,...drive,speed:10,driveStyle:0,model:-1,drivingStyle:2},
   {kind:'pause',time:800},
   {kind:'leaveAnyCar'},
   {kind:'achieveHeading',heading:180},
  ],false,opcode);
  return {drive,progress:m.runtime.world.pedSequenceProgress(driver)};
 },{...made,opcode:PERFORM});
 // First: the drive, with the ped walking to the driver's door.
 expect(plan.progress).toBe(0);
 const progress=()=>page.evaluate(({driver})=>(window as any).__game.missionForProfiling().runtime.world.pedSequenceProgress(driver),made);
 const status=()=>page.evaluate(({driver,opcode})=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(driver,opcode),{driver:made.driver,opcode:PERFORM});
 await expect.poll(()=>page.evaluate(({driver})=>!!(window as any).__game.missionForProfiling().peds.rideOf(driver),made),{timeout:60000}).toBe(true);
 expect(await status()).toBe(1);
 // Then the pause in the seat, and the walk once out.
 await expect.poll(progress,{timeout:90000}).toBe(1);
 const stopped=await page.evaluate(({car})=>(window as any).__game.missionForProfiling().vehicles.positionOf(car),made);
 expect(Math.hypot(stopped.x-plan.drive.x,stopped.y-plan.drive.y)).toBeLessThan(6);
 await expect.poll(progress,{timeout:30000}).toBe(3);
 expect(await page.evaluate(({driver})=>(window as any).__game.missionForProfiling().peds.rideOf(driver)??null,made)).toBeNull();
 await expect.poll(status,{timeout:60000}).toBe(7);
 expect(await progress()).toBe(-1);
 const at=await page.evaluate(({driver})=>(window as any).__game.missionForProfiling().peds.positionOf(driver),made);
 // Beside the car it stopped, facing south within CTaskSimpleAchieveHeading's 0.2 radian tolerance.
 expect(Math.hypot(at.x-stopped.x,at.y-stopped.y)).toBeLessThan(4);
 expect(Math.abs(await page.evaluate(({driver})=>(window as any).__game.missionForProfiling().peds.headingOf(driver),made)-180)).toBeLessThan(11.5);
 // An on-foot sequence reads its progress too; a task given on its own is no sequence.
 const onFoot=await page.evaluate(({driver,opcode})=>{
  const w=(window as any).__game.missionForProfiling().runtime.world;
  w.givePedScriptedTask(driver,{kind:'pause',time:5000},0x05d4);const single=w.pedSequenceProgress(driver);
  w.givePedSequence(driver,[{kind:'pause',time:700},{kind:'pause',time:700}],false,opcode);
  return {single,first:w.pedSequenceProgress(driver)};
 },{...made,opcode:PERFORM});
 expect(onFoot).toEqual({single:-1,first:0});
 await expect.poll(progress,{timeout:20000}).toBe(1);
 await expect.poll(progress,{timeout:20000}).toBe(-1);
 expect(errors).toEqual([]);
});
