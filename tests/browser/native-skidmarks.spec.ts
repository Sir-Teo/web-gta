import {test,expect} from '@playwright/test';

test('a handbrake stop lays native skidmarks with the particleskid raster',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 // The Greenwood streams in after CJ lands; F does nothing until it is there.
 await expect.poll(async()=>(await state()).nativeCar!=null,{timeout:30000}).toBe(true);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).nativeCar.occupied,{timeout:15000}).toBe(true);
 await page.waitForTimeout(1500);
 // What this test is about is the marks the handbrake lays, so it counts from whatever the street has already
 // put down — traffic braking nearby lays marks of its own, and requiring none made the test depend on there
 // being no traffic yet.
 const before=(await state()).skidmarks;
 expect(before.textured).toBe(true);
 expect(before.bloody).toBe(0);
 await page.keyboard.down('KeyW');await page.waitForTimeout(2200);await page.keyboard.up('KeyW');
 // The handbrake locks the rear wheels (WHEEL_STATE_FIXED): each lays a mark.
 await page.keyboard.down('Space');
 await expect.poll(async()=>(await state()).skidmarks.marks-before.marks,{timeout:4000}).toBeGreaterThanOrEqual(2);
 await page.waitForTimeout(1000);await page.keyboard.up('Space');
 await page.screenshot({path:'artifacts/native-skidmarks.png'});
 expect(errors).toEqual([]);
});
