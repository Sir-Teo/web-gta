import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('the frame limiter draws 30 frames a second over the 60 Hz simulation, idles the menu at 10 and lifts when switched off',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game)).toBe(true);
 // Under the menu the loop idles at 10 a second.
 await page.waitForTimeout(500);
 const m0=await state();await page.waitForTimeout(2000);const m1=await state();
 const menuFps=(m1.frameProfile.frames-m0.frameProfile.frames)/2;
 expect(menuFps).toBeLessThanOrEqual(13);
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await page.waitForTimeout(1500);
 expect((await state()).frameLimiter).toBe(true);
 const a=await state();await page.waitForTimeout(3000);const b=await state();
 const fps=(b.frameProfile.frames-a.frameProfile.frames)/3,ticks=(b.tick-a.tick)/3;
 console.log('LIMITER '+JSON.stringify({fps,ticks}));
 expect(fps).toBeGreaterThanOrEqual(24);expect(fps).toBeLessThanOrEqual(34);
 expect(ticks).toBeGreaterThanOrEqual(54);expect(ticks).toBeLessThanOrEqual(62);
 // Off: every display frame draws (headless Chromium's 60 Hz), the simulation unchanged.
 await page.evaluate(()=>(window as any).__game.setFrameLimiter(false));
 const c=await state();await page.waitForTimeout(3000);const d=await state();
 const free=(d.frameProfile.frames-c.frameProfile.frames)/3;
 console.log('FREE '+JSON.stringify({free,ticks:(d.tick-c.tick)/3}));
 expect(free).toBeGreaterThan(fps*1.3);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('grove-display-v1')!))).toEqual({frameLimiter:false});
 expect(errors).toEqual([]);
});
