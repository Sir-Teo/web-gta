import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
// CCarCtrl::UpdateCarOnRails (Vice City; SA's is a stub): traffic beyond the physics radius drives on rails instead of freezing.
test('traffic beyond the active radius keeps driving its lane on rails',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 // INTRO takes CJ away into the police car a few seconds in, leaving the traffic made round him behind.
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game?.state().traffic?.ready&&(window as any).__game.state().nativeCharacter,undefined,{timeout:60000});
 // Cars are made closing on the player 38 to 75 units off, so the 100-unit radius would see few leave it: a radius of
 // 40 (a phone's is 60) puts them on rails from the start.
 await page.evaluate(()=>{const g=(window as any).__game;g.traffic().physicsRadius=40;for(const c of g.fleet().cars)if(c.autopilot)c.activeRadius=40;});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 const railed=async()=>(await state()).traffic.cars.find((c:any)=>c.rails&&c.speed>2);
 await expect.poll(async()=>!!(await railed()),{timeout:90000}).toBe(true);
 const car=await railed();
 const before=car.position;await page.waitForTimeout(1000);
 const after=(await state()).traffic.cars.find((c:any)=>c.rails&&Math.hypot(c.position.x-before.x,c.position.z-before.z)<20);
 expect(after).toBeTruthy();
 expect(Math.hypot(after.position.x-before.x,after.position.z-before.z)).toBeGreaterThan(1.5);
 expect(after.alignment).toBeGreaterThan(.95);expect(after.laneError).toBeLessThan(1);
 expect(errors).toEqual([]);
});
