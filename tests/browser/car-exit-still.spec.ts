import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('CJ stands still after closing the car door: the run up to the car does not carry into steps after the exit',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).nativeCar!=null,{timeout:30000}).toBe(true);
 await page.waitForTimeout(1000);
 // Sprint toward the Greenwood, then enter it while running.
 await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyW');await page.waitForTimeout(500);
 await page.keyboard.press('KeyF');await page.waitForTimeout(300);await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');
 await expect.poll(async()=>(await state()).nativeCar?.occupied,{timeout:15000}).toBe(true);
 expect((await state()).player.moveBlend).toBe(0);
 await page.waitForTimeout(1000);
 await page.keyboard.down('KeyW');await page.waitForTimeout(1000);await page.keyboard.up('KeyW');await page.waitForTimeout(2000);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).carEntry.phase??null,{timeout:5000}).toBe('getOut');
 await expect.poll(async()=>(await state()).carEntry.phase??null,{timeout:8000}).toBeNull();
 const out=(await state()).player;const start={x:out.position.x,z:out.position.z};
 // No input for 1.5 s: he stays put, at no speed, with the move blend at rest.
 const samples:{d:number;speed:number;blend:number}[]=[];
 for(let i=0;i<15;i++){await page.waitForTimeout(100);const p=(await state()).player;samples.push({d:Math.hypot(p.position.x-start.x,p.position.z-start.z),speed:p.speed,blend:p.moveBlend});}
 expect(Math.max(...samples.map(s=>s.d))).toBeLessThan(0.15);
 expect(Math.max(...samples.map(s=>s.speed))).toBeLessThan(0.3);
 expect(Math.max(...samples.map(s=>s.blend))).toBe(0);
 expect(errors).toEqual([]);
});
