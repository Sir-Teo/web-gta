import {test,expect} from '@playwright/test';
// CTaskSimplePlayerOnFoot::PlayerControlDucked: a jump press or sprint stands a crouched CJ up; the jump press does not
// also jump.
test('jump and sprint stand a crouched CJ up',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await page.keyboard.press('KeyC');await expect.poll(async()=>(await state()).player.crouched).toBe(true);
 const y=(await state()).player.position.y;
 await page.keyboard.press('Space');
 await expect.poll(async()=>(await state()).player.crouched).toBe(false);
 // Standing up, not jumping.
 for(let i=0;i<6;i++){await page.waitForTimeout(80);expect((await state()).player.position.y).toBeLessThan(y+.5);}
 await page.keyboard.press('KeyC');await expect.poll(async()=>(await state()).player.crouched).toBe(true);
 await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyW');
 await expect.poll(async()=>(await state()).player.crouched).toBe(false);
 await expect.poll(async()=>(await state()).player.speed).toBeGreaterThan(4);
 await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');
 expect(errors).toEqual([]);
});
