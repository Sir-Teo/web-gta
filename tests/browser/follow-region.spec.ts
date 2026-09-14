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
 await game.evaluate(token=>{const observations:any[]=[];(window as any).__followObservations=observations;(window as any).__lateFollowReplies=[];const c=new BroadcastChannel(`scene-test-${token}`);c.onmessage=({data})=>{if(data.type==='region-request'){observations.push({request:data,state:(window as any).__game.state()});if(data.id===2)c.postMessage({type:'region-source-error',followId:data.id,message:'Diagnostic source failure'});}if(data.type==='replace-terrain')(window as any).__lateFollowReplies.push(data.followId);};},new URL(url).searchParams.get('sceneTest'));
 await game.keyboard.down('Shift');await game.keyboard.down('w');
 await expect.poll(async()=>(await state()).following.requests,{timeout:30000}).toBeGreaterThan(0);
 await game.keyboard.up('w');await game.keyboard.up('Shift');
 await expect.poll(async()=>(await state()).following.pending,{timeout:30000}).toBeNull();
 const after=await state();expect(after.following.enabled).toBe(true);expect(after.paused).toBe(false);expect(game.url()).toBe(url);
 expect(after.following.region.x!==before.following.region.x||after.following.region.y!==before.following.region.y).toBe(true);
 expect(Math.hypot(after.player.position.x-before.player.position.x,after.player.position.z-before.player.position.z)).toBeGreaterThan(24);
 const observations=await game.evaluate(()=>(window as any).__followObservations);expect(observations).toHaveLength(1);
 // Native locomotion can finish decelerating after the automatic resume. The
 // paused exact-pose invariant is checked separately by region-session.spec.ts.
 expect(after.following.region.x).toBe(observations[0].state.player.position.x);expect(after.following.region.y).toBe(-observations[0].state.player.position.z);
 expect(Math.hypot(after.player.position.x-observations[0].state.player.position.x,after.player.position.z-observations[0].state.player.position.z)).toBeLessThan(1);
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);await game.screenshot({path:'artifacts/native-following-chiliad-east.png'});
 const retainedInstances=(await state()).importedInstances;
 await game.keyboard.down('Shift');await game.keyboard.down('w');await expect.poll(async()=>(await state()).following.enabled,{timeout:30000}).toBe(false);await game.keyboard.up('w');await game.keyboard.up('Shift');
 await expect(game.locator('.menu')).toContainText('Diagnostic source failure');
 await expect.poll(()=>game.evaluate(()=>(window as any).__lateFollowReplies.includes(2)),{timeout:30000}).toBe(true);
 const failed=await state();expect(failed.paused).toBe(true);expect(failed.importedInstances).toBe(retainedInstances);expect(failed.following.requests).toBe(2);expect(failed.following.pending).toBeNull();
 await game.getByRole('button',{name:'Resume game',exact:true}).click();await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 expect(errors).toEqual([]);await game.close();
});
