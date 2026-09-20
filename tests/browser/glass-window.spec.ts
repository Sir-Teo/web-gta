import {test,expect} from '@playwright/test';

test('bullets crack and then shatter the showroom windows of Otto\'s Autos into falling panes',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await page.keyboard.press('Tab');await page.locator('[data-weapon="22"]').click();
 await expect.poll(async()=>(await state()).weapons.ready).toBe(true);
 // Otto's Autos, San Fierro (native -1650, 1215): drop in from above and let the window stream.
 await page.evaluate(()=>(window as any).__game.placePlayer(-1650,120,-1215));
 await expect.poll(async()=>{const s=await state();return s.player.grounded&&s.following?.region?.x!==2495;},{timeout:90000}).toBe(true);
 await expect.poll(async()=>(await page.evaluate(()=>(window as any).__game.glassNear(40).length)),{timeout:30000}).toBeGreaterThan(0);
 // Pick a ground-floor pane and a street-level stand 6 units away whose line of sight reaches that pane's collider first.
 const stand=await page.evaluate(()=>{
  const g=(window as any).__game,world=g.sim.world,RAPIER=g.RAPIER;
  const windows=g.glassNear(40).filter((w:any)=>w.position[2]<10);
  for(const w of windows){
   const c=world.getCollider(w.handle);if(!c)continue;const t=c.translation();
   for(const [dx,dz] of [[-6,0],[6,0],[0,-6],[0,6],[-4,-4],[4,4],[-4,4],[4,-4]]){
    const x=t.x+dx,z=t.z+dz,y=g.groundAt(x,z,t.y+4);
    if(!(y>t.y-3&&y<t.y+3))continue;
    const from={x,y:y+1.2,z},dir={x:t.x-x,y:t.y-(y+1.2),z:t.z-z},l=Math.hypot(dir.x,dir.y,dir.z);
    const hit=world.castRay(new RAPIER.Ray(from,{x:dir.x/l,y:dir.y/l,z:dir.z/l}),l+1,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
    if(hit&&hit.collider.handle===w.handle)return {x,y,z,target:[t.x,t.y,t.z],handle:w.handle,model:w.model};
   }
  }
  return null;
 });
 expect(stand).not.toBeNull();
 await page.evaluate(({x,y,z})=>(window as any).__game.placePlayer(x,y+.05,z),stand!);
 await page.waitForTimeout(500);
 let cracked=0,broken=0,panes=0;
 for(let i=0;i<24&&!broken;i++){
  await page.evaluate(([x,y,z])=>(window as any).__game.fireAt(x,y,z),stand!.target);
  await page.waitForTimeout(400);
  const g=await page.evaluate(()=>(window as any).__game.glass());cracked=Math.max(cracked,g.cracked);broken=g.broken;panes=Math.max(panes,g.panes);
 }
 expect(cracked).toBeGreaterThanOrEqual(1);
 expect(broken).toBeGreaterThanOrEqual(1);
 expect(panes).toBeGreaterThan(0);
 // The broken window no longer collides or shows: its placement is gone from the glass list as an unbroken pane.
 const after=await page.evaluate(()=>(window as any).__game.glassNear(40));
 expect(after.some((w:any)=>w.state?.brokenAltogether)).toBe(true);
 // Panes fall and land within a few seconds.
 await expect.poll(async()=>(await page.evaluate(()=>(window as any).__game.glass().panes)),{timeout:20000}).toBe(0);
 expect(errors).toEqual([]);
});
