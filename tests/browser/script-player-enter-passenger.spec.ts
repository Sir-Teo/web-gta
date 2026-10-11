import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** TASK_ENTER_CAR_AS_PASSENGER on the player (CTaskComplexEnterCarAsPassenger): WUZI5's opening walks CJ round to the
 * passenger door of Woozie's car in a sequence. The player's tasks took only the driver's seat, and the thread gave up. */
const ENTER_AS_PASSENGER=0x05ca;
test('a script walks the player to a car\'s passenger door and sets him in the seat',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().vehicles.create(400,{x:p.x+9,y:-p.z+3,z:-100},0);});
 await page.waitForFunction((h:number)=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),car,{timeout:60000});
 await page.waitForTimeout(800);
 await page.evaluate(({car,opcode})=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.setPlayerControl(0,false);
  w.givePedScriptedTask(1,{kind:'enterCarAsPassenger',vehicle:car,time:-1,seat:-1},opcode);},{car,opcode:ENTER_AS_PASSENGER});
 const status=()=>page.evaluate(op=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(1,op),ENTER_AS_PASSENGER);
 expect(await status()).not.toBe(7);
 // He walks round and is set in: in the car, not its driver, and the task is over.
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.pedVehicle(1)),{timeout:20000}).toBe(car);
 expect(await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.vehicleDriver(h),car)).not.toBe(1);
 await expect.poll(status,{timeout:5000}).toBe(7);
 expect(errors).toEqual([]);
});
