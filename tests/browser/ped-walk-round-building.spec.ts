import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';
const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());
// CTaskComplexWalkRoundBuildingAttempt: a ped on a kill task that walks into a wall it cannot see its target over
// walks along it toward the side its target is on and round, rather than pushing into it. SWEET1B's crack den has a
// wall between its back room and the front, with a door at x 324: a dealer in the back room told to kill CJ, who
// stands in the front past the door, comes through it.
test('a ped told to kill CJ walks round the wall between them through the door',async({page})=>{
 test.setTimeout(300000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling();m.runtime.game.currentArea=5;m.adapterRef.setPedAreaVisible(1,5);m.adapterRef.setPedCoordinates(1,325,1121,1082.9);});
 await expect.poll(async()=>(await state(page)).lighting.area,{timeout:120000}).toBe(5);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:30000}).toBe(true);
 const ped=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling();return m.peds.create(25,'BALLAS1',{x:321.6,y:1126.3,z:1082.883});});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),ped,{timeout:60000});
 await page.evaluate(h=>{const m=(window as any).__game.missionForProfiling(),w=m.adapterRef;w.setPedAreaVisible(h,5);
  m.runtime.world.givePedScriptedTask(h,{kind:'killPedOnFoot',target:1,time:-1,flags:0,actionDelay:0,actionChance:0,mustBeOnFoot:true},0x05e2);},ped);
 // He meets the wall, walks round (the task shows on him), and comes out into the front room.
 let walkedRound=false;
 await expect.poll(async()=>{const s=await page.evaluate(h=>{const m=(window as any).__game.missionForProfiling(),e=m.peds.entity(h);return {round:!!e.walkRound,at:m.adapterRef.pedPosition(h)};},ped);
  walkedRound||=s.round;return s.at.y;},{timeout:30000,intervals:[200]}).toBeLessThan(1125);
 expect(walkedRound).toBe(true);
 const at=await page.evaluate(h=>(window as any).__game.missionForProfiling().adapterRef.pedPosition(h),ped);
 expect(Math.abs(at.x-324)).toBeLessThan(2.5);
 expect(errors).toEqual([]);
});
