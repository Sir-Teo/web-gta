import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

// CAEWaterCannonAudioEntity: the fire truck's jet keeps two voices on its last section while it sprays.
test('the water cannon jet plays its native voices while it sprays',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await endStoryMission(page);
 await expect.poll(async()=>(await state()).nativeCar!=null,{timeout:30000}).toBe(true);
 await page.waitForTimeout(1000);
 await page.evaluate(()=>(window as any).__game.spawnVehicle(407));
 await expect.poll(async()=>((await state()).fleet?.cars??[]).some((c:any)=>c.modelId===407),{timeout:30000}).toBe(true);
 await page.waitForTimeout(1500);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>((await state()).fleet?.cars??[]).some((c:any)=>c.modelId===407&&c.occupied),{timeout:20000}).toBe(true);
 await page.waitForTimeout(800);
 // Nothing plays before the gun is pressed.
 const idle=(await state()).audio.native?.waterCannon;
 expect(idle,JSON.stringify((await state()).audio.native)).toBeTruthy();
 expect(idle.playing).toBe(0);
 await page.keyboard.down('ControlLeft');
 await expect.poll(async()=>(await state()).waterCannon.sections,{timeout:8000}).toBeGreaterThan(8);
 // The jet's pair comes up (the banks are loaded in play), and the splash pair joins where it lands.
 await expect.poll(async()=>(await state()).audio.native.waterCannon.playing,{timeout:8000}).toBeGreaterThanOrEqual(2);
 // The splash pair joins once the jet reaches the ground.
 await expect.poll(async()=>(await state()).audio.native.waterCannon.splash,{timeout:8000}).toBe(true);
 await expect.poll(async()=>(await state()).audio.native.waterCannon.playing,{timeout:8000}).toBe(4);
 const spraying=(await state()).audio.native.waterCannon;
 expect(spraying.started).toBeGreaterThanOrEqual(4);
 await page.keyboard.up('ControlLeft');
 // The voices go when the jet drains.
 await expect.poll(async()=>(await state()).waterCannon.sections,{timeout:15000}).toBe(0);
 await expect.poll(async()=>(await state()).audio.native.waterCannon.playing,{timeout:8000}).toBe(0);
 expect(errors).toEqual([]);
 console.log(JSON.stringify({idle,spraying}));
});
