import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** TASK_GOTO_CHAR_OFFSET in a player sequence (CTaskComplexSeekEntity): TORENO2 opens by walking CJ up to Toreno
 * with his controls off. The player's tasks had no seek, and the thread gave up at the sequence. */
const GOTO_CHAR_OFFSET=0x06a8;
test('a script sends the player to a point off a ped, and he ends there facing him',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 // A ped twelve units east along Grove Street.
 const ped=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position;
  return m.peds.create(4,'MALE01',{x:p.x+12,y:-p.z,z:p.y+1});});
 await page.waitForFunction((h:number)=>!!(window as any).__game.missionForProfiling().peds.entity(h),ped,{timeout:45000});
 await page.waitForTimeout(500);
 await page.evaluate(({ped,opcode})=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.setPlayerControl(0,false);
  w.givePedScriptedTask(1,{kind:'gotoPedOffset',target:ped,time:10000,offsetX:3,offsetY:90},opcode);},{ped,opcode:GOTO_CHAR_OFFSET});
 const status=()=>page.evaluate(op=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(1,op),GOTO_CHAR_OFFSET);
 const near=()=>page.evaluate(h=>{const w=(window as any).__game.missionForProfiling().runtime.world,a=w.pedPosition(1),b=w.pedPosition(h);return Math.hypot(a.x-b.x,a.y-b.y);},ped);
 expect(await status()).not.toBe(7);
 // He makes his way over and the task ends there, three units off the ped.
 await expect.poll(status,{timeout:20000}).toBe(7);
 expect(await near()).toBeGreaterThan(2);expect(await near()).toBeLessThan(4);
 expect(errors).toEqual([]);
});
