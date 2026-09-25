import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CPad reaches the script: IS_BUTTON_PRESSED and GET_PAD_STATE read what the held keys make, on foot and at the
 * wheel (CControllerConfigManager's two mappings). */
test('the script reads the pad the keys make',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 const pad=()=>page.evaluate(()=>({...(window as any).__game.missionForProfiling().runtime.game.pads.pads[0]}));
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.missionForProfiling()),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyW');
 await expect.poll(async()=>{const p=await pad();return [p.cross,p.leftStickY];},{timeout:5000}).toEqual([255,-128]);
 await page.keyboard.up('ShiftLeft');await page.keyboard.up('KeyW');
 await expect.poll(async()=>{const p=await pad();return [p.cross,p.leftStickY];},{timeout:5000}).toEqual([0,0]);
 await expect.poll(async()=>(await state()).nativeCar!=null,{timeout:30000}).toBe(true);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).nativeCar.occupied,{timeout:15000}).toBe(true);
 // At the wheel W is VEHICLE_ACCELERATE (cross) and the left stick stays still.
 await page.keyboard.down('KeyW');
 await expect.poll(async()=>{const p=await pad();return [p.cross,p.leftStickY];},{timeout:5000}).toEqual([255,0]);
 await page.keyboard.up('KeyW');
 const scm=await page.evaluate(()=>(window as any).__game.missionForProfiling().snapshot());
 expect(scm.stopped).toBeNull();expect(scm.gaveUp).toEqual([]);
 expect(errors).toEqual([]);
});
