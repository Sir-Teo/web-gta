import {test,expect} from '@playwright/test';
// CBirds::Update and CBirds::Render: a flock flies at the camera by day; CBirds::HandleGunShot drops a bird a bullet
// passes through.
test('birds fly past the camera by day and a gunshot drops one',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await page.keyboard.press('Tab');await page.locator('[data-weapon="22"]').click();await expect.poll(async()=>(await state()).weapons.ready).toBe(true);
 // Frame 6 of 512 tries a flock; a building in its path can refuse one, so try from a few headings.
 for(let i=0;i<8&&(await state()).birds.count===0;i++){
  await page.evaluate(h=>{const g=(window as any).__game;g.turnPlayer(h);g.birdFrame(5);},i*Math.PI/4);
  await page.waitForTimeout(400);
 }
 const flying=await state();expect(flying.birds.count).toBeGreaterThan(0);
 // Face the nearest bird (native (x, y, z) is the renderer's (x, z, -y)): CalcScreenCoors does not draw a bird within
 // a unit of the near clip, so one behind the camera is not drawn.
 const nearest=async()=>{const s=await state(),p=s.player.position;return s.birds.positions.map(([x,y,z]:number[])=>({x,y:z,z:-y})).sort((a:any,b:any)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];};
 const faceNearest=async()=>{const b=await nearest(),p=(await state()).player.position;if(b)await page.evaluate(h=>(window as any).__game.turnPlayer(h),Math.atan2(b.x-p.x,b.z-p.z));};
 await expect.poll(async()=>{await faceNearest();await page.waitForTimeout(200);return (await state()).birds.drawn;},{timeout:8000}).toBeGreaterThan(0);
 await page.waitForTimeout(300);await page.screenshot({path:'artifacts/native-birds.png'});
 // Facing Grove Street, a first shot finds the bullet's line (from the muzzle along the aim); a bird 2.5 units along it,
 // flying on down the line, falls to the second.
 await page.evaluate(()=>(window as any).__game.turnPlayer(Math.PI));await page.waitForTimeout(200);
 const p=(await state()).player.position,aim={x:p.x,y:p.y+1.3,z:p.z-30};
 await page.evaluate(({x,y,z})=>(window as any).__game.fireAt(x,y,z),aim);
 await expect.poll(async()=>(await state()).lastBulletLine).not.toBeNull();
 // The muzzle settles as the aim pose raises the gun, so place the bird on the latest line, up to three times.
 for(let i=0;i<3&&(await state()).birds.shot===null;i++){
  await page.waitForTimeout(500);
  const [a,b]=(await state()).lastBulletLine,l=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z),at={x:a.x+(b.x-a.x)/l*2.5,y:a.y+(b.y-a.y)/l*2.5,z:a.z+(b.z-a.z)/l*2.5};
  await page.evaluate(({x,y,z,dx,dz})=>(window as any).__game.placeBird(x,y,z,dx,dz),{...at,dx:(b.x-a.x)/l,dz:(b.z-a.z)/l});
  expect(await page.evaluate(({x,y,z})=>(window as any).__game.fireAt(x,y,z),aim)).toBe(true);
  await page.waitForTimeout(100);
 }
 await expect.poll(async()=>(await state()).birds.shot,{timeout:3000}).not.toBeNull();
 expect(errors).toEqual([]);
});
