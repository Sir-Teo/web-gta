import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** TASK_FOLLOW_PATH_NODES_TO_COORD on the player (CTaskComplexFollowNodeRoute): CAT3 walks CJ over to the tanker along
 * the path nodes with his controls off. The player's tasks had no node route, and the thread gave up there. */
const FOLLOW_PATH_NODES=0x05f5;
test('a script walks the player along the path nodes to a point, and the task is then over',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 // Twenty-five units east along Grove Street (native axes).
 const target=await page.evaluate(opcode=>{
  const g=(window as any).__game,w=g.missionForProfiling().runtime.world,p=g.state().player.position;
  const at={x:p.x+25,y:-p.z,z:p.y};
  w.setPlayerControl(0,false);
  w.givePedScriptedTask(1,{kind:'followPathNodesToCoord',x:at.x,y:at.y,z:at.z,speed:4,time:-1,radius:1},opcode);
  return at;
 },FOLLOW_PATH_NODES);
 const status=()=>page.evaluate(op=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(1,op),FOLLOW_PATH_NODES);
 const left=()=>page.evaluate(t=>{const p=(window as any).__game.state().player.position;return Math.hypot(p.x-t.x,-p.z-t.y);},target);
 const start=await left();
 expect(await status()).not.toBe(7);
 // On his way, walking.
 await expect.poll(left,{timeout:8000}).toBeLessThan(start-3);
 // There, within the tolerance and a step, and the task is over.
 await expect.poll(status,{timeout:40000}).toBe(7);
 expect(await left()).toBeLessThan(2);
 expect(errors).toEqual([]);
});
