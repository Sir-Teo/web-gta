import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** A ped a script makes stands (CPed's default CTaskSimpleStandStill) until tasked. TASK_GO_STRAIGHT_TO_COORD walks it
 * to the point and it stands there, and the timed form puts a ped that is still on its way on the point once the time
 * runs out. */
test('a script ped stands until told, walks straight to a point, and a timed go-to puts it there',async({page})=>{
 test.setTimeout(360000);
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
 // TASK_FOLLOW_POINT_ROUTE, there and back (RETURN): along the line it has walked, ending where it started.
 const ROUTE=0x05d8;
 await page.evaluate(({handle,opcode,later,arrived})=>{
  const route=[{x:later.x,y:-later.z,z:-100},{x:arrived.x,y:-arrived.z,z:-100}];
  (window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(handle,{kind:'followPointRoute',speed:4,mode:1,route},opcode);
 },{handle:ped,opcode:ROUTE,later,arrived});
 await expect.poll(()=>page.evaluate(({handle,opcode})=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(handle,opcode),{handle:ped,opcode:ROUTE}),{timeout:120000}).toBe(7);
 // RETURN reverses at the end: later, arrived, then arrived, later.
 const routed=await where();
 expect(Math.hypot(routed.x-later.x,routed.z-later.z)).toBeLessThan(.8);
 // TASK_FOLLOW_PATH_NODES_TO_COORD back along the line: near and clear, so straight at it, ending within the
 // tolerance of the point.
 const NODES=0x05f5;
 await page.evaluate(({handle,opcode,arrived})=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(handle,
  {kind:'followPathNodesToCoord',x:arrived.x,y:-arrived.z,z:-100,speed:4,time:-1},opcode),{handle:ped,opcode:NODES,arrived});
 expect(await page.evaluate(({handle})=>(window as any).__game.missionForProfiling().peds.entity(handle).order?.kind,{handle:ped})).toBe('followNodeRoute');
 await expect.poll(()=>page.evaluate(({handle,opcode})=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(handle,opcode),{handle:ped,opcode:NODES}),{timeout:60000}).toBe(7);
 const noded=await where();
 expect(Math.hypot(noded.x-arrived.x,noded.z-arrived.z)).toBeLessThan(.6);
 // Timed: half a second to go 20 units at a walk is not enough, so the task sets it down on the point.
 const far={x:arrived.x-20,z:arrived.z};
 await go(far,4,500);
 await expect.poll(status,{timeout:10000}).toBe(7);
 const placed=await where();
 expect(Math.hypot(placed.x-far.x,placed.z-far.z)).toBeLessThan(.6);
 // TASK_GOTO_CHAR to the player, within two units.
 const GOTO=0x05d9;
 await page.evaluate(({handle,opcode})=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(handle,{kind:'gotoPed',target:1,time:20000,radius:2},opcode),{handle:ped,opcode:GOTO});
 await expect.poll(()=>page.evaluate(({handle,opcode})=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(handle,opcode),{handle:ped,opcode:GOTO}),{timeout:30000}).toBe(7);
 const near=await page.evaluate((handle:number)=>{const g=(window as any).__game,q=g.missionForProfiling().peds.entity(handle).actor.player.position,p=g.state().player.position;return Math.hypot(q.x-p.x,q.z-p.z);},ped);
 expect(near).toBeLessThan(2.6);
 // TASK_TOGGLE_DUCK: the ped crouches (the ped.ifp WEAPON_crouch pose) and the task is over; TASK_DUCK for a time.
 const DUCK=0x04eb,DUCK_FOR=0x05c5;
 const ducked=await page.evaluate(({handle,DUCK})=>{const m=(window as any).__game.missionForProfiling();m.runtime.world.givePedScriptedTask(handle,{kind:'toggleDuck',state:true},DUCK);return m.peds.entity(handle).actor.player.crouched;},{handle:ped,DUCK});
 expect(ducked).toBe(true);
 await page.evaluate(({handle,DUCK_FOR})=>{const m=(window as any).__game.missionForProfiling();m.runtime.world.givePedScriptedTask(handle,{kind:'duck',time:800},DUCK_FOR);},{handle:ped,DUCK_FOR});
 await expect.poll(()=>page.evaluate((handle:number)=>(window as any).__game.missionForProfiling().peds.entity(handle).actor.player.crouched,ped),{timeout:30000}).toBe(false);
 // TASK_LOOK_AT_CHAR at the player: the head look starts and the trigger task is over.
 const LOOK=0x05bf;
 const look=await page.evaluate(({handle,opcode})=>{
  const m=(window as any).__game.missionForProfiling();m.runtime.world.givePedScriptedTask(handle,{kind:'lookAtPed',target:1,time:3000},opcode);
  const p=m.peds.entity(handle);return {looking:!!p.look,target:p.lookTarget??null};
 },{handle:ped,opcode:LOOK});
 expect(look).toEqual({looking:true,target:null});
 await expect.poll(()=>page.evaluate(({handle,opcode})=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(handle,opcode),{handle:ped,opcode:LOOK}),{timeout:5000}).toBe(7);
 expect(errors).toEqual([]);
});
