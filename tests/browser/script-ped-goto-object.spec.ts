import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** TASK_GO_TO_OBJECT (iOS 0x1001f1434): CTaskComplexSeekEntity on a script object, as TASK_GOTO_CHAR's on a ped; DRIV2
 * sends its peds to an object with it and waits on the task's status. The command was skipped, so the ped never went. */
const GO_TO_OBJECT=0x06e2;
test('a script ped runs to a script object and the task is over within its radius',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 const made=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position,ground=g.groundAt(p.x+14,p.z,p.y+5);
  const object=m.runtime.game.objects.create('dyn_wine_big',{x:p.x+14,y:-p.z,z:ground+.3},{external:false,missionCleanup:false}).handle;
  const ped=m.peds.create(4,'MALE01',{x:p.x+2,y:-p.z+2,z:p.y+1});return {object,ped};});
 await page.waitForFunction((h:number)=>!!(window as any).__game.missionForProfiling().peds.entity(h),made.ped,{timeout:45000});
 await page.evaluate(({object,ped,opcode})=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(ped,{kind:'goToObject',object,time:-1,radius:1},opcode),{...made,opcode:GO_TO_OBJECT});
 const status=()=>page.evaluate(({ped,op})=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(ped,op),{ped:made.ped,op:GO_TO_OBJECT});
 const gap=()=>page.evaluate(({object,ped})=>{const m=(window as any).__game.missionForProfiling(),o=m.runtime.game.objects.at(object).position,p=m.runtime.world.pedPosition(ped);return Math.hypot(o.x-p.x,o.y-p.y);},made);
 expect(await status()).not.toBe(7);
 await expect.poll(status,{timeout:20000}).toBe(7);
 expect(await gap()).toBeLessThan(1.5);
 expect(errors).toEqual([]);
});
