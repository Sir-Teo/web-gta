import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** F pressed while CJ lies knocked down: the fall and get-up hold the event-response slot above the primary enter-car
 * task, which waits (no stall clock, no steering check) and runs him to the door once he is back up. */
test('an entry asked for while knocked down waits for the get-up, then goes to the door',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>{const s=(window as any).__game.state();return {knockdown:s.knockdown,phase:s.carEntry.phase,cancel:s.carEntry.cancelReason,occupied:s.nativeCar?.occupied};});
 await expect.poll(async()=>(await state()).occupied,{timeout:60000}).toBe(false);
 await page.evaluate(()=>{const g=(window as any).__game,c=g.state().nativeCar.position;g.placePlayer(c.x-3,c.y-.5,c.z);g.sim.knockdown=3;});
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).phase,{timeout:30000}).toBe('approach');
 // Still down: the approach holds without giving up.
 const held:({knockdown:number;phase:string|null;cancel:string|null})[]=[];
 for(let s=await state();s.knockdown>0;s=await state()){held.push(s);await page.waitForTimeout(100);}
 expect(held.length).toBeGreaterThan(0);
 expect(held.every(s=>s.phase==='approach'&&s.cancel===null)).toBe(true);
 await expect.poll(async()=>(await state()).occupied,{timeout:60000}).toBe(true);
 expect(errors).toEqual([]);
});
