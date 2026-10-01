import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';

const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());

// A script's SET_AREA_VISIBLE and SET_CHAR_COORDINATES take CJ between an interior and the street without a door, as
// INTRO2 takes him out of the pizza place to Sweet's car: CStreaming loads what CGame::currArea names round him, so the
// browser swaps its one window for the new place and he stands on its ground. A cutscene's area set while he waits
// outside (SWEET1B) leaves the street under him.
test('a script takes CJ into his house and out to the street without a door',async({page})=>{
 test.setTimeout(420000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 const script=(area:number,x:number,y:number,z:number)=>page.evaluate(([area,x,y,z])=>{
  const m=(window as any).__game.missionForProfiling();m.runtime.game.currentArea=area;m.adapterRef.setPedAreaVisible(1,area);
  if(x!==undefined)m.adapterRef.setPedCoordinates(1,x,y,z);},[area,x,y,z] as [number,number,number,number]);
 // A cutscene's area with no teleport: the street stays.
 await page.evaluate(()=>{(window as any).__game.missionForProfiling().runtime.game.currentArea=1;});
 await page.waitForTimeout(3000);
 expect((await state(page)).lighting.area).toBe(0);
 expect((await state(page)).player.grounded).toBe(true);
 // Into CJ's house (area 3), by its CARLS exit.
 await script(3,2496.05,-1692.93,1014.75);
 await expect.poll(async()=>(await state(page)).lighting.area,{timeout:120000}).toBe(3);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:30000}).toBe(true);
 const inside=(await state(page)).player.position;
 expect(Math.hypot(inside.x-2496.05,inside.z-1692.93)).toBeLessThan(1.5);
 expect(inside.y).toBeGreaterThan(1012);expect(inside.y).toBeLessThan(1016);
 expect((await state(page)).following).toBeNull();
 // Out to the pizza place's car park, as INTRO2 does (SET_AREA_VISIBLE 0, SET_CHAR_AREA_VISIBLE $3 0, then the point).
 await script(0,2102.21,-1806.65,12.4);
 await expect.poll(async()=>(await state(page)).lighting.area,{timeout:120000}).toBe(0);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:30000}).toBe(true);
 const out=(await state(page)).player.position;
 expect(Math.hypot(out.x-2102.21,out.z-1806.65)).toBeLessThan(1.5);
 expect(out.y).toBeGreaterThan(11);expect(out.y).toBeLessThan(15);
 expect((await state(page)).following?.enabled).toBe(true);
 expect((await state(page)).entryExits.stack).toEqual([]);
 await page.waitForTimeout(1500);
 await page.screenshot({path:'artifacts/script-area-transfer.png'});
 expect(await page.evaluate(()=>(window as any).__game.missionForProfiling().snapshot().gaveUp)).toEqual([]);
 expect(errors).toEqual([]);
});
