import {test,expect} from '@playwright/test';

test('a pistol round knocks a cardboard box loose through DoBulletImpact',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).objectKinds.includes('dummy'),{timeout:30000}).toBe(true);
 await page.keyboard.press('Backquote');await page.locator('[data-weapon="22"]').click();
 await expect.poll(async()=>(await state()).weapons.ready).toBe(true);
 // The cardboard box on the kerb at native (2492.27, -1653.99, 12.90): uproot limit 0, mass 10.
 const box={x:2492.27,y:12.9+.25,z:1653.99};
 // Stand CJ on the road a few metres south of it.
 await page.evaluate(()=>(window as any).__game.placePlayer(2492.3,12.6,1660));await page.waitForTimeout(400);
 // The pistol's spread can miss a small box at this range, so up to five rounds, a moment apart.
 const loose=async()=>(await page.evaluate(()=>(window as any).__game.movedProps())).find((p:any)=>p.key.startsWith('cardboardbox:2492.27'))?.dynamic??false;
 for(let shot=0;shot<5&&!await loose();shot++){
  await page.evaluate(({x,y,z})=>(window as any).__game.fireAt(x,y,z),box);
  await page.waitForTimeout(700);
 }
 await expect.poll(loose,{timeout:5000}).toBe(true);
 await page.waitForTimeout(1500);
 const moved=(await page.evaluate(()=>(window as any).__game.movedProps())).find((p:any)=>p.key.startsWith('cardboardbox:2492.27'));
 // Pushed along the shot, away from CJ at the house.
 expect(Math.hypot(moved.at.x-box.x,moved.at.z-box.z)).toBeGreaterThan(.3);
 expect(errors).toEqual([]);
});
