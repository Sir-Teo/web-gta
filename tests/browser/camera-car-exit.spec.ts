import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** Entering the starter car from the front used to leave the camera where it stood, in front of the car; leaving the
 * car without driving then put it in CJ's face and forward walked him toward it. The car camera now swings behind the
 * vehicle as soon as CJ is in, and the on-foot camera hangs on a string behind his movement. */
test('the camera is behind the car once seated and behind CJ after he leaves it',async({page})=>{
 test.setTimeout(180000);
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 const gameWait=async(seconds:number)=>{const start=await page.evaluate(()=>(window as any).__game.gameTimeMs());await page.waitForFunction(({start,seconds})=>(window as any).__game.gameTimeMs()>start+seconds*1000,{start,seconds},{timeout:60000});};
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await page.locator('canvas.world').click({position:{x:400,y:300}});await page.waitForTimeout(1500);
 const behind=(s:any)=>{const d=((s.camera.yaw-s.player.heading-Math.PI)*180/Math.PI)%360;return Math.abs(((d%360)+540)%360-180);};
 const car=(await state()).fleet.cars.find((c:any)=>c.id==='starter');
 await page.evaluate(({x,z})=>{const g=(window as any).__game;g.placePlayer(x,g.groundAt(x,z,300)+.05,z);g.turnPlayer(0);},{x:car.position.x,z:car.position.z+6});
 await page.waitForTimeout(800);
 await page.keyboard.press('KeyF');
 // This camera check waits for the native entry task; its clips can outlast ten wall seconds under capped stepping.
 await expect.poll(async()=>(await state()).carEntry.phase,{timeout:30000}).toBe('seated');
 await expect.poll(async()=>behind(await state()),{timeout:30000}).toBeLessThan(10);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).carEntry.phase,{timeout:30000}).toBeNull();
 await expect.poll(async()=>behind(await state()),{timeout:30000}).toBeLessThan(10);
 const out=await state();expect(behind(out)).toBeLessThan(10);
 // Forward walks away from the camera.
 await page.keyboard.down('KeyW');try{await gameWait(1);}finally{await page.keyboard.up('KeyW');}
 const walked=await state();
 expect(Math.hypot(walked.player.position.x-out.player.position.x,walked.player.position.z-out.player.position.z)).toBeGreaterThan(2);
 expect(behind(walked)).toBeLessThan(15);
});
