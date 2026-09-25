import {test,expect} from '@playwright/test';
/** The player's driving tasks: TASK_CAR_TEMP_ACTION and TASK_CAR_DRIVE_TO_COORD on the car he sits in drive it on its
 * autopilot with him at the wheel, and the pad has the car back once they are over. */
test('a script drives the player’s car forward a moment, then to a point',async({page})=>{
 test.setTimeout(240000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 const car=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position;return m.vehicles.create(400,{x:p.x+6,y:-p.z,z:p.y},90);});
 await page.waitForFunction((car:number)=>!!(window as any).__game.missionForProfiling().vehicles.entity(car),car,{timeout:45000});
 await page.evaluate((car:number)=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCar(1,car),car);
 await expect.poll(()=>page.evaluate((car:number)=>(window as any).__game.missionForProfiling().runtime.world.pedIsSittingInCar(1,car),car),{timeout:10000}).toBe(true);
 const TEMP=0x06c7,DRIVE=0x05d1;
 const status=(opcode:number)=>page.evaluate(opcode=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(1,opcode),opcode);
 const at=()=>page.evaluate((car:number)=>(window as any).__game.missionForProfiling().vehicles.positionOf(car),car);
 // TEMPACT_GOFORWARD (9) for a second and a half: the car rolls on west and the task ends.
 const from=await at();
 await page.evaluate(({car,opcode})=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(1,{kind:'carTempAction',vehicle:car,actionId:9,time:1500},opcode),{car,opcode:TEMP});
 await expect.poll(()=>status(TEMP),{timeout:5000}).toBe(1);
 await expect.poll(()=>status(TEMP),{timeout:30000}).toBe(7);
 const rolled=await at();
 expect(Math.hypot(rolled.x-from.x,rolled.y-from.y)).toBeGreaterThan(1);
 expect(await page.evaluate((car:number)=>(window as any).__game.missionForProfiling().vehicles.entity(car).scriptDriven,car)).toBe(false);
 // TASK_CAR_DRIVE_TO_COORD twelve units on: the car gets there, and the pad has it back.
 const goal=await page.evaluate(({car,opcode})=>{const m=(window as any).__game.missionForProfiling(),c=m.vehicles.positionOf(car),goal={x:c.x-12,y:c.y,z:c.z};
  m.runtime.world.givePedScriptedTask(1,{kind:'carDriveToCoord',vehicle:car,...goal,speed:10,driveStyle:2,model:-1,drivingStyle:2},opcode);return goal;},{car,opcode:DRIVE});
 await expect.poll(()=>status(DRIVE),{timeout:60000}).toBe(7);
 const there=await at();
 expect(Math.hypot(there.x-goal.x,there.y-goal.y)).toBeLessThan(6);
 const after=await page.evaluate((car:number)=>{const e=(window as any).__game.missionForProfiling().vehicles.entity(car);return {scripted:e.scriptDriven,autopilot:e.autopilot??null,occupied:e.occupied};},car);
 expect(after).toEqual({scripted:false,autopilot:null,occupied:true});
 expect(errors).toEqual([]);
});
