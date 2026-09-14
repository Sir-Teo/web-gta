import {test,expect} from '@playwright/test';
test('included native procedural models appear in walking and stay owned across pause',async({page})=>{
 test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore Verdant Meadows',exact:true}).click({timeout:60000});
 const state=()=>page.evaluate(()=>(window as any).__game.state().nativeVegetation.procedural);
 await expect.poll(async()=>(await state())?.entities??0).toBeGreaterThan(0);
 await expect.poll(async()=>(await state())?.colliders??0).toBeGreaterThan(0);
 await page.keyboard.down('KeyW');await page.waitForTimeout(1000);await page.keyboard.up('KeyW');
 await page.keyboard.press('Escape');const before=await state();
 expect(before.pool.active).toBe(before.entities);expect(before.pool.free+before.pool.active+before.pool.detached).toBe(512);
 await page.waitForTimeout(500);expect(await state()).toEqual(before);
 await page.getByRole('button',{name:'Resume game',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.proceduralPixelProbe().changed)).toBeGreaterThan(20);
 await page.screenshot({path:'artifacts/walking-procedural.png'});
 console.log(JSON.stringify(await state()));expect(errors).toEqual([]);
});
