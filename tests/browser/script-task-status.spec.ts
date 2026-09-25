import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** GET_SCRIPT_TASK_STATUS through CPedScriptedTaskRecord: a task the script gives is EVENT_ASSOCIATED until the next
 * Process, TASK_ASSOCIATED while the ped holds it, and FINISHED_TASK (7) once it is over or cleared. */
test('a script ped’s task reports its status until it finishes',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const ped=await page.evaluate(()=>{
  const game=(window as any).__game,mission=game.missionForProfiling(),p=game.state().player.position;
  return mission.peds.create(4,'MALE01',{x:p.x+4,y:-p.z,z:p.y});
 });
 await page.waitForFunction((handle:number)=>!!(window as any).__game.missionForProfiling().peds.entity(handle),ped,{timeout:45000});
 const STAND_STILL=0x05ba;
 const status=(opcode=STAND_STILL)=>page.evaluate(({handle,opcode})=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(handle,opcode),{handle:ped,opcode});
 // Nothing given yet: finished.
 expect(await status()).toBe(7);
 // Read in the same evaluate: the next Process makes it TASK_ASSOCIATED, and a frame may run between two evaluates.
 expect(await page.evaluate(({handle,opcode})=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.givePedScriptedTask(handle,{kind:'standStill',time:1500},opcode);return w.scriptTaskStatus(handle,opcode);},{handle:ped,opcode:STAND_STILL})).toBe(0);
 // Another task's opcode is not this one's.
 expect(await status(0x05d3)).toBe(7);
 await expect.poll(()=>status(),{timeout:10000}).toBe(1);
 await expect.poll(()=>status(),{timeout:30000}).toBe(7);
 // A cleared task is finished at once.
 await page.evaluate(({handle,opcode})=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.givePedScriptedTask(handle,{kind:'standStill',time:60000},opcode);w.clearPedTasks(handle);},{handle:ped,opcode:STAND_STILL});
 expect(await status()).toBe(7);
 expect(errors).toEqual([]);
});
