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
 // The car parks 14 units along the heat-seeker camera's own line. Every other vehicle is made untargetable, as
 // VEHICLE_CAN_BE_TARGETTED_BY_HS_MISSILE does: streaming traffic up the street can be in view too, and once marked it
 // would stay preferred.
 await page.evaluate(()=>{
  const g=(window as any).__game,w=g.weapons(),cam=w.lockCamera,p=g.state().player.position;
  const l=Math.hypot(cam.direction.x,cam.direction.z),dx=cam.direction.x/l,dz=cam.direction.z/l;
  g.placeCar(p.x+dx*14,13.3,p.z+dz*14,Math.atan2(dx,dz));
  (window as any).__hsOnly=setInterval(()=>{
   const n=g.state().nativeCar,f=w.fleet();if(!n||!f)return;
   for(const v of [...f.cars,...f.boats,...(f.bikes??[]),...(f.planes??[])]){const t=(v.car?.body??v.body).translation();v.hsTargetable=t.x===n.position.x&&t.z===n.position.z;}
  },50);
 });
 const ours=()=>page.evaluate(()=>{const g=(window as any).__game,w=g.weapons(),n=g.state().nativeCar;return w.hsLock.marked!==undefined&&!!n&&w.heatSeekBody(w.hsLock.marked)?.translation().x===n.position.x;});
 await expect.poll(ours,{timeout:5000}).toBe(true);
 const marked=Date.now();
 // 1.5 s of game time; the headless game runs well under real time, so the wait is wall time to spare.
 await expect.poll(async()=>(await state()).weapons.heatSeek.locked,{timeout:15000}).toBe(true);
 expect(Date.now()-marked).toBeGreaterThan(1000);
 const before=(await state()).weapons.explosions;
 await page.keyboard.press('ControlLeft');
 await expect.poll(async()=>(await state()).weapons.explosions,{timeout:8000}).toBeGreaterThan(before);
 await page.mouse.up({button:'right'});
 await expect.poll(async()=>(await state()).weapons.heatSeek.target).toBeNull();
 await page.evaluate(()=>clearInterval((window as any).__hsOnly));
 expect(errors).toEqual([]);
});
