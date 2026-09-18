import {test,expect} from '@playwright/test';

test('walking into a cardboard box knocks it loose and pushes it along',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).objectKinds.includes('dummy'),{timeout:30000}).toBe(true);
 // Two metres south of the box on the kerb (native 2492.27, -1653.99), facing it.
 await page.evaluate(()=>(window as any).__game.placePlayer(2492.27,12.6,1656.2));
 await page.waitForTimeout(500);
 const key='cardboardbox:2492.27:-1653.99:12.90';
 await page.keyboard.down('KeyW');
 await expect.poll(async()=>(await page.evaluate(()=>(window as any).__game.movedProps())).find((p:any)=>p.key===key)?.dynamic??false,{timeout:6000}).toBe(true);
 await page.waitForTimeout(800);await page.keyboard.up('KeyW');
 const box=(await page.evaluate(()=>(window as any).__game.movedProps())).find((p:any)=>p.key===key);
 // Pushed on ahead of CJ, northwards (renderer -z).
 expect(box.at.z).toBeLessThan(1653.99-.2);
 expect(errors).toEqual([]);
});
