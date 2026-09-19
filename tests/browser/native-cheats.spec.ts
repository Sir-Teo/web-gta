import {test,expect} from '@playwright/test';
// CCheat: typed PC codes. HESOYAM pays and heals, AEZAKMI keeps the stars away, AIWPRTON sets a Rhino down across
// CJ's path, ZEIIVG toggles green lights on and off, and KANGAROO multiplies the jump force by ten.
test('typed cheat codes apply their effects',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2470,g.groundAt(2470,1660,30),1660);g.turnPlayer(Math.PI/2);});
 await page.waitForTimeout(500);
 const money=(await state()).money;
 await page.keyboard.type('HESOYAM',{delay:30});
 await expect.poll(async()=>(await state()).cheats.times).toBe(1);
 const paid=await state();expect(paid.player.armour).toBe(100);expect(paid.player.health).toBe(100);
 expect(paid.money-money).toBe(250000);
 await page.keyboard.type('AEZAKMI',{delay:30});await page.keyboard.type('OSRBLHH',{delay:30});
 await expect.poll(async()=>(await state()).cheats.times).toBe(3);
 expect((await state()).cheats.active).toContain('neverWanted');expect((await state()).wanted.level).toBe(0);
 await page.keyboard.type('AIWPRTON',{delay:30});
 await expect.poll(async()=>(await state()).fleet.cars.some((c:any)=>c.modelId===432),{timeout:20000}).toBe(true);
 const s=await state(),rhino=s.fleet.cars.find((c:any)=>c.modelId===432),p=s.player.position;
 // In front of CJ (heading π/2, +x), its bounding radius and 2 units out.
 expect(rhino.position.x-p.x).toBeGreaterThan(4);expect(Math.abs(rhino.position.z-p.z)).toBeLessThan(rhino.position.x-p.x);
 await page.keyboard.type('ZEIIVG',{delay:30});await expect.poll(async()=>(await state()).cheats.active).toContain('greenLights');
 await page.keyboard.type('ZEIIVG',{delay:30});await expect.poll(async()=>(await state()).cheats.active).not.toContain('greenLights');
 // Mega jump: ten times the 8.5 launch force.
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2482,g.groundAt(2482,1676,40),1676);});await page.waitForTimeout(500);
 await page.keyboard.type('KANGAROO',{delay:30});await expect.poll(async()=>(await state()).cheats.active).toContain('megaJump');
 const ground=(await state()).player.position.y;
 await page.keyboard.down('Space');await page.waitForTimeout(100);await page.keyboard.up('Space');
 let peak=ground;for(let i=0;i<20;i++){await page.waitForTimeout(100);peak=Math.max(peak,(await state()).player.position.y);}
 expect(peak-ground).toBeGreaterThan(20);
 await page.screenshot({path:'artifacts/native-cheats.png'});
 expect(errors).toEqual([]);
});
