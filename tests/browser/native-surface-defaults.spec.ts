import {test,expect} from '@playwright/test';
// LoadSurfaceInfos: the published world's SURFINFO.DAT, delivered with its scene environment, decides where CJ may sprint and climb (cliffs, glass, lamp posts
// and doors refuse a climb; interior floors refuse a sprint).
test('the published world loads its surface sprint and climb flags',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).movementSurfaceDefinitions,{timeout:30000}).toBeGreaterThan(150);
 // Grove Street's road allows sprinting.
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 expect((await state()).surfaceSprintBlocked).toBe(false);
 expect(errors).toEqual([]);
});
