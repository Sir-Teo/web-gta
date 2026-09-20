import {test,expect} from '@playwright/test';
test('default world keeps walking across the first streamed terrain replacement',async({page})=>{
 test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');
 await expect.poll(async()=>{const s=await state();return s.player.position.z;},{timeout:10000}).toBeLessThan(1665);await page.keyboard.up('KeyW');
 // The follow camera hangs on a string, so a held sideways key circles CJ round it: face west and run forward.
 await page.evaluate(()=>(window as any).__game.turnPlayer(Math.PI/2));await page.keyboard.down('KeyW');
 try{
  await expect.poll(async()=>{const s=await state();return s.following.requests;},{timeout:60000,intervals:[5000]}).toBeGreaterThan(0);
  await expect.poll(async()=>{const s=await state();return s.following.enabled&&s.following.pending===null;},{timeout:60000}).toBe(true);
 }finally{await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');}
 const final=await state();expect(final.following.region.x).not.toBe(2495);expect(final.importedInstances).toBeGreaterThan(0);expect(final.nativeCharacter).not.toBeNull();expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/san-andreas-streamed-walk.png'});
});
