import {test,expect} from '@playwright/test';
test('walking requests native terrain and resumes in place without reopening the game',async({page})=>{
 test.setTimeout(90000);const depot=process.env.GTA_CONTENT_DIR;test.skip(!depot,'Requires native content depot.');
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/models.html');await page.getByLabel('Local content folder',{exact:true}).setInputFiles(depot!);
 await page.getByLabel('Map region',{exact:true}).selectOption('chiliad-east');await page.getByLabel('Area radius',{exact:true}).fill('64');
 await page.getByRole('button',{name:'Load region from folder',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Archive scene assembled locally.',{timeout:45000});
 await page.getByLabel('Load terrain as you walk',{exact:true}).check();
 const popup=page.waitForEvent('popup');await page.getByRole('button',{name:'Walk scene',exact:true}).click();const game=await popup;game.on('pageerror',e=>errors.push(e.message));
 const state=()=>game.evaluate(()=>(window as any).__game.state());
 await game.getByRole('button',{name:'Walk imported scene',exact:true}).click();await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 const before=await state(),url=game.url();expect(before.following).toMatchObject({enabled:true,requests:0});
 // Record the exact pose immediately after requesting and before installation.
 await game.evaluate(token=>{const observations:any[]=[];(window as any).__followObservations=observations;(window as any).__lateFollowReplies=[];const c=new BroadcastChannel(`scene-test-${token}`);c.onmessage=({data})=>{if(data.type==='region-request'){observations.push({request:data,state:(window as any).__game.state()});if(data.id===3)c.postMessage({type:'region-source-error',followId:data.id,message:'Diagnostic source failure'});}if(data.type==='replace-terrain')(window as any).__lateFollowReplies.push(data.followId);};},new URL(url).searchParams.get('sceneTest'));
 await game.keyboard.down('Shift');await game.keyboard.down('w');
 await expect.poll(async()=>(await state()).following.requests,{timeout:30000}).toBeGreaterThan(0);
 await expect.poll(async()=>(await state()).following.pending,{timeout:30000}).toBeNull();
 await game.keyboard.up('w');await game.keyboard.up('Shift');
 const after=await state();expect(after.following.enabled).toBe(true);expect(after.paused).toBe(false);expect(game.url()).toBe(url);
 expect(after.following.region.x!==before.following.region.x||after.following.region.y!==before.following.region.y).toBe(true);
 expect(Math.hypot(after.player.position.x-before.player.position.x,after.player.position.z-before.player.position.z)).toBeGreaterThan(24);
 const observations=await game.evaluate(()=>(window as any).__followObservations);expect(observations).toHaveLength(1);
 // The worker prepares the window while normal input continues to move CJ.
 expect(observations[0].state.paused).toBe(false);
 expect(after.following.region).toEqual(observations[0].request.region);
 expect(Math.hypot(after.player.position.x-observations[0].state.player.position.x,after.player.position.z-observations[0].state.player.position.z)).toBeGreaterThan(.02);
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);await game.screenshot({path:'artifacts/native-following-chiliad-east.png'});
 // The initial provider opens its own immutable folder session. Its second
 // successful request must reuse collision from that same session.
 await game.keyboard.down('Shift');await game.keyboard.down('w');await expect.poll(async()=>(await state()).following.requests,{timeout:30000}).toBe(2);
 await expect.poll(async()=>(await state()).following.pending,{timeout:30000}).toBeNull();await game.keyboard.up('w');await game.keyboard.up('Shift');
 expect((await state()).importedReusedPlacements).toBeGreaterThan(0);expect((await state()).importedReusedColliders).toBeGreaterThan(0);
 const retainedInstances=(await state()).importedInstances;
 await game.keyboard.down('Shift');await game.keyboard.down('w');await expect.poll(async()=>(await state()).following.enabled,{timeout:30000}).toBe(false);await game.keyboard.up('w');await game.keyboard.up('Shift');
 await expect(game.locator('.menu')).toContainText('Diagnostic source failure');
 await expect.poll(()=>game.evaluate(()=>(window as any).__lateFollowReplies.includes(3)),{timeout:30000}).toBe(true);
 const failed=await state();expect(failed.paused).toBe(true);expect(failed.importedInstances).toBe(retainedInstances);expect(failed.following.requests).toBe(3);expect(failed.following.pending).toBeNull();
 await game.getByRole('button',{name:'Resume game',exact:true}).click();await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 expect(errors).toEqual([]);await game.close();
});

test('slow prefetch pauses inside the old boundary and resumes when the worker is ready',async({page})=>{
 test.setTimeout(90000);const depot=process.env.GTA_CONTENT_DIR;test.skip(!depot,'Requires native content depot.');
 await page.goto('/models.html');await page.getByLabel('Local content folder',{exact:true}).setInputFiles(depot!);
 await page.getByLabel('Map region',{exact:true}).selectOption('chiliad-east');await page.getByLabel('Area radius',{exact:true}).fill('64');
 await page.getByRole('button',{name:'Load region from folder',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Archive scene assembled locally.',{timeout:45000});
 await page.getByLabel('Load terrain as you walk',{exact:true}).check();const popup=page.waitForEvent('popup');await page.getByRole('button',{name:'Walk scene',exact:true}).click();const game=await popup;
 const state=()=>game.evaluate(()=>(window as any).__game.state());
 await game.getByRole('button',{name:'Walk imported scene',exact:true}).click();await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 let release:(()=>void)|undefined,held=false;
 await page.context().route('**/src/assets/model.worker.ts*',async route=>{
  if(!held){held=true;await new Promise<void>(resolve=>{release=resolve;});}
  await route.continue();
 });
 try{
  const before=await state();await game.keyboard.down('Shift');await game.keyboard.down('w');
  await expect.poll(()=>held,{timeout:30000}).toBe(true);
  await expect.poll(async()=>(await state()).paused,{timeout:30000}).toBe(true);await game.keyboard.up('w');await game.keyboard.up('Shift');
  await expect(game.locator('.menu')).toContainText('Waiting for nearby terrain');
  const waiting=await state(),distance=Math.hypot(waiting.player.position.x-before.following.region.x,waiting.player.position.z+before.following.region.y);
  expect(distance).toBeGreaterThanOrEqual(48);expect(distance).toBeLessThan(50);expect(waiting.following.pending).toBe(1);expect(waiting.importedInstances).toBe(before.importedInstances);
  release!();await expect.poll(async()=>(await state()).following.pending,{timeout:30000}).toBeNull();
  expect((await state()).paused).toBe(false);await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 }finally{release?.();await page.context().unroute('**/src/assets/model.worker.ts*');await game.close();}
});
