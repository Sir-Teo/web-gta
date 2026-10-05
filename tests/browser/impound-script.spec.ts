import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';

const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());
const mission=(page:Page)=>page.evaluate(()=>{const m=(window as any).__game.missionForProfiling(),s=m.snapshot();
 return {threads:s.threads.map((t:any)=>String(t.name).toLowerCase()),gaveUp:s.gaveUp};});
const global=(page:Page,offset:number)=>page.evaluate(o=>((window as any).__game.missionForProfiling().runtime.active[0].thread.globals as DataView).getInt32(o,true),offset);

// impound.scm, the police pounds' gates, guards and cars: MAIN's IMPND_L starts it within 120 units of the Los Santos
// police station once $7464 is set. It had been held back, as it stopped at IS_COP_VEHICLE_IN_AREA_3D_NO_SAVE (now the
// iOS handler) and used TASK_GOTO_CHAR_AIMING, TASK_GO_TO_COORD_WHILE_AIMING and TASK_COWER.
test('the Los Santos impound\'s script runs, and its gate answers a police car',async({page})=>{
 test.setTimeout(300000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.fleet()),{timeout:60000}).toBe(true);
 // $7464 (a byte offset, not Sanny's numbering), which the story sets.
 await page.evaluate(()=>{((window as any).__game.missionForProfiling().runtime.active[0].thread.globals as DataView).setInt32(7464,1,true);});
 await page.evaluate(()=>{(window as any).__game.placePlayer(1520,14,1660);});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.groundAt(1520,1660,40)),{timeout:120000}).toBeGreaterThan(5);
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(1520,g.groundAt(1520,1660,40)+.05,1660);});
 await expect.poll(async()=>{const s=await state(page);return !s.terrainHold&&s.player.grounded;},{timeout:120000}).toBe(true);
 await expect.poll(async()=>(await mission(page)).threads,{timeout:60000}).toContain('impnd');
 await page.waitForTimeout(3000);
 // No police car at the gate: shut.
 expect(await global(page,42920)).toBe(0);
 // A police car (LSPD, 596) at the barrier: with its guard in the booth, the barrier lifts.
 await page.evaluate(async()=>{const g=(window as any).__game;await g.fleet().spawnScriptCar(596,{x:1548,y:g.groundAt(1548,1626,20),z:1626},0);});
 // The gate's state: lifting (1), and up (2) once the barrier has turned its quarter.
 await expect.poll(()=>global(page,42920),{timeout:20000}).not.toBe(0);
 await expect.poll(()=>global(page,42920),{timeout:30000}).toBe(2);
 expect((await mission(page)).threads).toContain('impnd');
 expect((await mission(page)).gaveUp).toEqual([]);
 expect(errors).toEqual([]);
});
