import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';

const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());
const car=(page:Page)=>page.evaluate(()=>{const c=[...(window as any).__game.fleet().cars].find((c:any)=>c.modelId===400&&c.missionCar);if(!c)return undefined;const t=c.car.body.translation();return {x:t.x,z:t.z,broken:c.engineBroken,running:c.engineRunning};});

// SET_CAR_ENGINE_BROKEN (the iOS handler; valet.scm uses it): CJ can get in, but the engine stays off and the car
// does not drive (CAutomobile::ProcessControlInputs: no gas, a 0.05 brake). Before, the command had no handler and the
// script gave up.
test('a car whose engine a script broke will not drive',async({page})=>{
 test.setTimeout(300000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.fleet()),{timeout:60000}).toBe(true);
 await page.evaluate(()=>{(window as any).__game.placePlayer(1829.9,14,1858.1);});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.groundAt(1825.5,1858.1,20)),{timeout:120000}).toBeGreaterThan(10);
 await page.evaluate(async()=>{const g=(window as any).__game;await g.fleet().spawnScriptCar(400,{x:1825.5,y:g.groundAt(1825.5,1858.1,20),z:1858.1},0);});
 await expect.poll(()=>car(page),{timeout:60000}).toBeTruthy();
 // What the mission's adapter sets for the script's command (vehicleFlags.bEngineBroken, the engine off).
 await page.evaluate(()=>{const g=(window as any).__game,c=[...g.fleet().cars].find((c:any)=>c.modelId===400&&c.missionCar);c.engineBroken=true;c.engineRunning=false;});
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(1823.2,g.groundAt(1823.2,1858.1,20)+.05,1858.1);g.turnPlayer(Math.PI/2);});
 await expect.poll(async()=>{const s=await state(page);return !s.terrainHold&&s.player.grounded;},{timeout:30000}).toBe(true);
 await page.locator('canvas.world').click({position:{x:400,y:300}});
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state(page)).carEntry.phase,{timeout:60000}).toBe('seated');
 const before=(await car(page))!;expect(before.running).toBe(false);
 await page.keyboard.down('KeyW');await page.waitForTimeout(2500);
 const held=(await car(page))!;await page.keyboard.up('KeyW');
 expect(Math.hypot(held.x-before.x,held.z-before.z)).toBeLessThan(.5);expect(held.running).toBe(false);
 // Mended, it drives.
 await page.evaluate(()=>{const c=[...(window as any).__game.fleet().cars].find((c:any)=>c.modelId===400&&c.missionCar);c.engineBroken=false;c.engineRunning=true;});
 await page.keyboard.down('KeyW');await page.waitForTimeout(2500);
 const driven=(await car(page))!;await page.keyboard.up('KeyW');
 expect(Math.hypot(driven.x-held.x,driven.z-held.z)).toBeGreaterThan(2);
 expect(errors).toEqual([]);
});
