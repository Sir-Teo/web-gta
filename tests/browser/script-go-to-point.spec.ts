import {test,expect} from '@playwright/test';
/** A ped a script makes stands (CPed's default CTaskSimpleStandStill) until tasked. TASK_GO_STRAIGHT_TO_COORD walks it
 * to the point and it stands there, and the timed form puts a ped that is still on its way on the point once the time
 * runs out. */
test('a script ped stands until told, walks straight to a point, and a timed go-to puts it there',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 const ped=await page.evaluate(()=>{
  const game=(window as any).__game,mission=game.missionForProfiling(),p=game.state().player.position;
  return mission.peds.create(4,'MALE01',{x:p.x+4,y:-p.z,z:p.y});
 });
 await page.waitForFunction((handle:number)=>!!(window as any).__game.missionForProfiling().peds.entity(handle),ped,{timeout:45000});
 const where=()=>page.evaluate((handle:number)=>{const q=(window as any).__game.missionForProfiling().peds.entity(handle).actor.player.position;return {x:q.x,z:q.z};},ped);
 await page.waitForTimeout(1000);
 const start=await where();
 await page.waitForTimeout(3000);
 const later=await where();
 // No wander: it has not walked off.
 expect(Math.hypot(later.x-start.x,later.z-start.z)).toBeLessThan(.3);
 const GO_STRAIGHT=0x05d3;
 const status=()=>page.evaluate(({handle,opcode})=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(handle,opcode),{handle:ped,opcode:GO_STRAIGHT});
 const go=(to:{x:number;z:number},moveState:number,time:number)=>page.evaluate(({handle,opcode,to,moveState,time})=>
  (window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(handle,{kind:'goStraightToCoord',x:to.x,y:-to.z,z:-100,speed:moveState,time},opcode),
  {handle:ped,opcode:GO_STRAIGHT,to,moveState,time});
 const target={x:later.x+5,z:later.z};
 await go(target,4,-1);
 await expect.poll(status,{timeout:30000}).toBe(7);
 const arrived=await where();
 expect(Math.hypot(arrived.x-target.x,arrived.z-target.z)).toBeLessThan(.6);
 // It stays where it arrived.
 await page.waitForTimeout(2000);
 const stayed=await where();
 expect(Math.hypot(stayed.x-arrived.x,stayed.z-arrived.z)).toBeLessThan(.3);
 // Timed: half a second to go 20 units at a walk is not enough, so the task sets it down on the point.
 const far={x:arrived.x-20,z:arrived.z};
 await go(far,4,500);
 await expect.poll(status,{timeout:10000}).toBe(7);
 const placed=await where();
 expect(Math.hypot(placed.x-far.x,placed.z-far.z)).toBeLessThan(.6);
 expect(errors).toEqual([]);
});
