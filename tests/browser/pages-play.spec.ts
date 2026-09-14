import {test,expect} from '@playwright/test';
test('included native region loads and supports grounded walking without local imports',async({page})=>{
 test.setTimeout(90000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore Verdant Meadows',exact:true}).click({timeout:60000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().player.grounded)).toBe(true);
 const before=await page.evaluate(()=>(window as any).__game.state());
 expect(before.imported).toBe(true);expect(before.importedInstances).toBe(164);expect(before.nativeCharacter).not.toBeNull();
 await page.keyboard.down('KeyW');
 await expect.poll(async()=>{const p=await page.evaluate(()=>(window as any).__game.state().player.position);return Math.hypot(p.x-before.player.position.x,p.z-before.player.position.z);}).toBeGreaterThan(1);
 await page.keyboard.up('KeyW');
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().player.grounded)).toBe(true);
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Save game',exact:true})).toBeHidden();
 await page.getByRole('button',{name:'Resume game',exact:true}).click();
 expect(await page.evaluate(()=>(window as any).__game.state().paused)).toBe(false);expect(errors).toEqual([]);
});
