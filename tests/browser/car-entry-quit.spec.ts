import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** "To stop Carl from entering a car once he has opened the door or dragged out a driver or passenger, use the movement
 * controls or press PED_FIREWEAPON": CTaskComplexEnterCar latches IsPlayerToQuitCarEnter while the door opens and
 * finishes after it, the door left open. Pushing toward the car at the open door afterwards still gets him in. */
test('backing off while the door opens stops the entry after it, door left open, and pushing on toward the car enters',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>{const s=(window as any).__game.state();return {phase:s.carEntry.phase,cancel:s.carEntry.cancelReason,occupied:s.nativeCar?.occupied,door:s.nativeCar?.doors[2]?.ratio??0};});
 await expect.poll(async()=>(await state()).occupied,{timeout:60000}).toBe(false);
 const place=()=>page.evaluate(()=>{const g=(window as any).__game,c=g.state().nativeCar.position;g.placePlayer(c.x-2.5,c.y-.5,c.z);g.turnPlayer(Math.PI/2);});
 await place();await page.waitForTimeout(600);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).phase,{timeout:30000}).toBe('open');
 await page.keyboard.down('KeyS');
 await expect.poll(async()=>(await state()).cancel,{timeout:30000}).toBe('quit');
 await page.keyboard.up('KeyS');
 const quit=await state();
 expect(quit.phase).toBeNull();expect(quit.occupied).toBe(false);expect(quit.door).toBeGreaterThan(.9);
 // Back at the door, now open past him: pushing toward the car is not backing off, and he gets in.
 await page.waitForTimeout(1500);await place();await page.waitForTimeout(600);
 await page.keyboard.press('KeyF');await page.keyboard.down('KeyW');
 await expect.poll(async()=>(await state()).occupied,{timeout:30000}).toBe(true);
 await page.keyboard.up('KeyW');
 expect(errors).toEqual([]);
});
