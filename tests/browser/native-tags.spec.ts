import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
// CTagManager: Ganton's tag under the freeway starts as the Kilo Tray Ballas tag; spraying it paints CJ's Grove tag in
// over it 8 alpha a shot (CWorld::SprayPaintWorld) and counts it once past 228.
test('spraying a rival tag paints the Grove tag over it',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await endStoryMission(page);
 await expect.poll(async()=>(await state()).tags?.total,{timeout:30000}).toBe(100);
 expect((await state()).tags.tagged).toBe(0);
 // tag_kilo at native (2422.9, -1682.3, 14.0) faces west: stand 2.6 m west of it, facing east. A spray shot travels
 // 0.05 a step for its 1000 ms lifespan (2.5 m) and paints tags within 0.5 of where it ends.
 await page.evaluate(()=>{const g=(window as any).__game,x=2420.3,z=1682.3;g.placePlayer(x,g.groundAt(x,z,16),z);g.turnPlayer(Math.PI/2);});
 await page.waitForTimeout(1500);
 await page.screenshot({path:'artifacts/native-tags-before.png'});
 await page.keyboard.press('Backquote');await page.locator('[data-weapon="41"]').click();await expect.poll(async()=>(await state()).weapons.ready).toBe(true);
 for(let i=0;i<400&&(await state()).tags.tagged===0;i++){await page.evaluate(()=>(window as any).__game.fireAt(2422.9,14.0,1682.3));await page.waitForTimeout(40);}
 const s=await state();expect(s.tags.tagged).toBe(1);expect(s.tags.sprayed).toBe(1);
 await page.waitForTimeout(1500);
 await page.screenshot({path:'artifacts/native-tags-after.png'});
 expect(errors).toEqual([]);
});
