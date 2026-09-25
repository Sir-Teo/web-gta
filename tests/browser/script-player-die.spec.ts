import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** TASK_LOOK_AT_COORD on the player turns his head and is over at once; TASK_DIE kills him whatever he is proof
 * against (CTaskComplexDie is no damage). */
test('the script turns the player’s head to a point, then kills him',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const LOOK=0x06a9,DIE=0x05be;
 const look=await page.evaluate(opcode=>{
  const g=(window as any).__game,w=g.missionForProfiling().runtime.world,p=g.state().player.position;
  w.givePedScriptedTask(1,{kind:'lookAtCoord',x:p.x+5,y:-p.z,z:p.y+1,time:2000},opcode);return w.scriptTaskStatus(1,opcode);
 },LOOK);
 expect(look).toBe(0);
 await expect.poll(()=>page.evaluate(opcode=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(1,opcode),LOOK),{timeout:5000}).toBe(7);
 // Proof against everything (SET_CHAR_PROOFS), and still the task kills him.
 await page.evaluate(opcode=>{const w=(window as any).__game.missionForProfiling().runtime.world;
  w.setPedProofs(1,{bullet:true,fire:true,explosion:true,collision:true,melee:true});w.givePedScriptedTask(1,{kind:'die'},opcode);},DIE);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().player.health),{timeout:5000}).toBe(0);
 expect(errors).toEqual([]);
});
