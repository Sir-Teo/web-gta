import {test,expect} from '@playwright/test';

// CTaskSimpleUseGun::RequirePistolWhip: firing at a ped within a unit in front swings the gun butt instead of shooting.
test('firing a pistol at a ped in reach pistol-whips it with GUN_BUTT and spends no round',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>{const s=await state();return !!s.weapons?.ready&&!!s.nativeCharacter&&(s.pedestrians?.people?.length??0)>0;},{timeout:60000}).toBe(true);
 await page.keyboard.press('Tab');await page.locator('[data-weapon="22"]').click();await expect.poll(async()=>(await state()).weapons.ready).toBe(true);
 const s0=await state(),h=s0.player.heading,at={x:s0.player.position.x+Math.sin(h)*.8,y:s0.player.position.y,z:s0.player.position.z+Math.cos(h)*.8};
 const id=await page.evaluate(([x,y,z])=>(window as any).__game.placePed(x,y,z),[at.x,at.y,at.z]);expect(id).not.toBeNull();
 await page.waitForTimeout(400);
 const ped=async()=>(await state()).pedestrians.people.find((p:any)=>p.id===id);
 const clip=(await state()).weapons.clip;
 await page.mouse.move(700,450);await page.mouse.down();await page.waitForTimeout(40);await page.mouse.up();
 await page.waitForTimeout(120);expect((await state()).nativeCharacter.reaction).toBe('gun_butt');
 // melee.dat PISTOL_WHIP lands on frame 7 for 10 (the player's attack stat applies); the victim plays HIT_GUN_BUTT.
 await expect.poll(async()=>(await ped())?.health).toBeLessThan(100);
 expect((await ped())?.reaction).toBe('hit_gun_butt');expect((await state()).weapons.clip).toBe(clip);
 expect(errors).toEqual([]);
});
