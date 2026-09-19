import {test,expect} from '@playwright/test';

test('a handbrake stop lays native skidmarks with the particleskid raster',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).nativeCar.occupied,{timeout:15000}).toBe(true);
 await page.waitForTimeout(1500);
 expect((await state()).skidmarks).toEqual({marks:0,bloody:0,textured:true});
 await page.keyboard.down('KeyW');await page.waitForTimeout(2200);await page.keyboard.up('KeyW');
 // The handbrake locks the rear wheels (WHEEL_STATE_FIXED): each lays a mark.
 await page.keyboard.down('Space');
 await expect.poll(async()=>(await state()).skidmarks.marks,{timeout:4000}).toBeGreaterThanOrEqual(2);
 await page.waitForTimeout(1000);await page.keyboard.up('Space');
 await page.screenshot({path:'artifacts/native-skidmarks.png'});
 expect(errors).toEqual([]);
});
