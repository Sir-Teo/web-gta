import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';
const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());
// A mission's CREATE_CHAR waits for the collision under the ped, and a ped whose feet start a little under a surface
// (a patient on a slope) is set on it when it comes in. A ped made on the floor beside furniture is not: SWEET1B's
// couch dealer, made against the crack den's couch, was lifted onto its seat and slid off behind it.
test('a waiting script ped made against furniture stays on the floor',async({page})=>{
 test.setTimeout(300000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling();m.runtime.game.currentArea=5;m.adapterRef.setPedAreaVisible(1,5);m.adapterRef.setPedCoordinates(1,318,1122,1082.9);});
 await expect.poll(async()=>(await state(page)).lighting.area,{timeout:120000}).toBe(5);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:30000}).toBe(true);
 // As the mission's own CREATE_CHAR makes it: waiting for its collision.
 const ped=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling();m.nextPedWaitsForCollision=true;
  try{return m.peds.create(25,'BALLAS1',{x:325.7,y:1130,z:1082.883});}finally{m.nextPedWaitsForCollision=false;}});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),ped,{timeout:60000});
 await page.waitForTimeout(3000);
 const at=await page.evaluate(h=>(window as any).__game.missionForProfiling().adapterRef.pedPosition(h),ped);
 expect(at.z).toBeLessThan(1084.1);expect(at.z).toBeGreaterThan(1083.6);
 expect(Math.hypot(at.x-325.7,at.y-1130)).toBeLessThan(.3);
 expect(errors).toEqual([]);
});
