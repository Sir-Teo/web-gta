import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CCam::Process_1stPerson in a car: the fourth V press in a vehicle is the bumper view, FOV 60, from the front-seat
 * dummy (x ignored) plus (0, 0.08, 0.62) in the car's frame, looking along the car; the next press is back to near. */
test('the car camera cycles into the FOV-60 bumper view and out again',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 const clock=()=>page.evaluate(()=>(window as any).__game.gameTimeMs()/1000);
 const gameWait=async(s:number)=>{const t0=await clock();await expect.poll(clock,{timeout:60000}).toBeGreaterThan(t0+s);};
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(async()=>(await state()).nativeCar!=null,{timeout:30000}).toBe(true);
 await page.locator('canvas.world').click({position:{x:400,y:300}});await gameWait(.5);
 await page.evaluate(()=>(window as any).__game.placeCar(2491,13.3,1680,0));await gameWait(.5);
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2491,g.groundAt(2491,1684,300)+.05,1684);g.turnPlayer(0);});
 await expect.poll(async()=>{const s=await state();return !s.terrainHold&&s.player.grounded;},{timeout:30000}).toBe(true);await gameWait(.5);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).carEntry.phase,{timeout:60000}).toBe('seated');await gameWait(.5);
 const cam=()=>page.evaluate(()=>{const g=(window as any).__game,r=g.render(),c=g.state().nativeCar;return {fov:r.fov,mode:r.cameraSettings.vehicle,x:r.camera.position.x,y:r.camera.position.y,z:r.camera.position.z,car:c.position,heading:c.heading};});
 const start=await cam();expect(start.mode).toBe('medium');
 await page.keyboard.press('KeyV');await expect.poll(async()=>(await cam()).mode).toBe('far');
 await page.keyboard.press('KeyV');await expect.poll(async()=>(await cam()).mode).toBe('bumper');
 await gameWait(.3);
 const bumper=await cam();
 expect(bumper.fov).toBe(60);
 // Inside the car: within a unit and a half of its centre across the ground, and above its floor.
 expect(Math.hypot(bumper.x-bumper.car.x,bumper.z-bumper.car.z)).toBeLessThan(1.5);
 expect(bumper.y-bumper.car.y).toBeGreaterThan(.3);expect(bumper.y-bumper.car.y).toBeLessThan(1.6);
 await page.keyboard.press('KeyV');
 await expect.poll(async()=>(await cam()).mode).toBe('near');
 await gameWait(.5);expect((await cam()).fov).not.toBe(60);
 expect(errors).toEqual([]);
});
