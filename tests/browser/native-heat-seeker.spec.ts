import {test,expect} from '@playwright/test';

// CCam::Process_Rocket for the heat seeker: PickTargetForHeatSeekingMissile marks a car ahead, and the crosshair
// locks (red) after 1.5 s on the same target in sight. FireProjectile then sends a homing rocket at it.
test('the heat seeker marks a car ahead, locks after 1.5 s and fires at it',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await page.evaluate(()=>(window as any).__game.placePlayer(2480,12.6,1668));await page.waitForTimeout(300);
 await page.keyboard.press('Tab');await page.locator('[data-weapon="36"]').click();await expect.poll(async()=>(await state()).weapons.ready).toBe(true);
 await page.mouse.move(720,450);await page.mouse.down({button:'right'});
 await expect.poll(async()=>(await state()).camera.firstPerson).toBe('rocketHs');
 // Nothing to mark yet; then the car parks 14 units along CJ's (the camera's) heading.
 const s=await state(),h=s.player.heading,p=s.player.position;
 expect(s.weapons.heatSeek).toEqual({target:null,locked:false});
 await page.evaluate(([x,z,heading])=>(window as any).__game.placeCar(x,13.3,z,heading),[p.x+Math.sin(h)*14,p.z+Math.cos(h)*14,h]);
 await expect.poll(async()=>(await state()).weapons.heatSeek.target,{timeout:5000}).not.toBeNull();
 const marked=Date.now();
 await expect.poll(async()=>(await state()).weapons.heatSeek.locked,{timeout:6000}).toBe(true);
 expect(Date.now()-marked).toBeGreaterThan(1000);
 const before=(await state()).weapons.explosions;
 await page.keyboard.press('ControlLeft');
 await expect.poll(async()=>(await state()).weapons.explosions,{timeout:8000}).toBeGreaterThan(before);
 await page.mouse.up({button:'right'});
 await expect.poll(async()=>(await state()).weapons.heatSeek.target).toBeNull();
 expect(errors).toEqual([]);
});
