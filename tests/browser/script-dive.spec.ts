import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** TASK_DIVE_AND_GET_UP (INTRO1's drive-by scene): CTaskComplexEvasiveDiveAndGetUp with its heading first. A
 * script ped turns along the dive, plays EV_DIVE, lies for the script's time and gets up, and its task ends with it;
 * the player does the same through his knockdown. TASK_LOOK_AT_VEHICLE starts a look at the car. */
test('a script ped and the player dive and get up, and a ped looks at a car',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const ped=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().peds.create(4,'MALE01',{x:p.x+4,y:-p.z,z:p.y});});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),ped,{timeout:60000});
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().vehicles.create(596,{x:p.x-6,y:-p.z+7,z:-100},0);});
 await page.waitForFunction(c=>!!(window as any).__game.missionForProfiling().vehicles.entity(c),car,{timeout:60000});
 const DIVE=0x0645,LOOK=0x0603,STATUS=(h:number,op:number)=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus?.(h,op);
 await page.evaluate(({h,c,look})=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.givePedScriptedTask(h,{kind:'lookAtVehicle',vehicle:c,time:2000},look);},{h:ped,c:car,look:LOOK});
 const before=await page.evaluate(h=>{const g=(window as any).__game,e=g.missionForProfiling().peds.entity(h);return {x:e.actor.player.position.x,z:e.actor.player.position.z,look:!!e.look,player:{...g.sim.player.position}};},ped);
 expect(before.look).toBe(true);
 // Dive east (script +x) for a second on the ground.
 await page.evaluate(({h,op})=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.givePedScriptedTask(h,{kind:'diveAndGetUp',x:1,y:0,time:1000},op);w.givePedScriptedTask(1,{kind:'diveAndGetUp',x:0,y:1,time:500},op);},{h:ped,op:DIVE});
 await expect.poll(()=>page.evaluate(h=>!!(window as any).__game.missionForProfiling().peds.entity(h).evade,ped),{timeout:10000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().knockdown??(window as any).__game.sim?.()?.knockdown??0),{timeout:10000}).not.toBe(0);
 // Both come back up and the ped's task is over.
 await expect.poll(()=>page.evaluate(h=>!(window as any).__game.missionForProfiling().peds.entity(h).evade,ped),{timeout:60000}).toBe(true);
 const after=await page.evaluate(h=>{const e=(window as any).__game.missionForProfiling().peds.entity(h);return {x:e.actor.player.position.x,z:e.actor.player.position.z,order:e.order?.kind??null};},ped);
 // EV_DIVE carries it several units along the dive, east.
 expect(after.x-before.x).toBeGreaterThan(3);
 expect(after.order).not.toBe('dive');
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.sim.knockdown),{timeout:30000}).toBe(0);
 const player=await page.evaluate(()=>{const g=(window as any).__game;return {position:{...g.sim.player.position},heading:g.sim.player.heading,status:g.missionForProfiling().runtime.world.scriptTaskStatus(1,0x645)};});
 expect(before.player.z-player.position.z).toBeGreaterThan(3);expect(Math.abs(Math.atan2(Math.sin(player.heading-Math.PI/2),Math.cos(player.heading-Math.PI/2)))).toBeLessThan(.21);expect(player.status).toBe(7);
 expect(errors).toEqual([]);
});
