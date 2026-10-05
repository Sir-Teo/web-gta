import {test,expect} from '@playwright/test';
/** CAERadioTrackManager's emergency channel: a police car's radio plays the AA pack (the iOS port's AA.osw), bursts of
 * static with their intros and outros and the dispatcher between them, each track fetched as the stream reaches it;
 * getting out stops it. A saved game starts CJ at Grove Street, past the opening's ride. */
test('a police car plays the emergency channel, and stops it when CJ gets out',async({page})=>{
 test.setTimeout(240000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const fetched:number[]=[];page.on('request',r=>{const m=r.url().match(/\/play\/audio\/streams\/track-(\d+)\.mp3$/);if(m)fetched.push(Number(m[1]));});
 await page.addInitScript(()=>{localStorage.setItem('web-gta.progress.v1',JSON.stringify({version:1,money:0,savedLocation:{x:2495,y:-1680,z:13.3,heading:1,timeMinutes:720}}));});
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.state().fadeAlpha),{timeout:90000}).toBe(0);
 await page.waitForFunction(()=>((window as any).__game.missionForProfiling()?.runtime.active.length??0)>2,undefined,{timeout:60000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 const radio=async()=>(await state()).audio.native?.radio;
 await expect.poll(async()=>(await radio())?.mode,{timeout:30000}).toBe(7);
 await page.evaluate(()=>(window as any).__game.spawnVehicle(596));
 await expect.poll(async()=>((await state()).fleet?.cars??[]).some((c:any)=>c.modelId===596),{timeout:30000}).toBe(true);
 await page.waitForTimeout(1500);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>((await state()).fleet?.cars??[]).some((c:any)=>c.modelId===596&&c.occupied),{timeout:20000}).toBe(true);
 // The channel comes on, and the stream plays its first track.
 await expect.poll(async()=>(await radio()).mode,{timeout:20000}).toBe(2);
 expect((await radio()).station).toBe(0);
 const first=(await radio()).stream;
 expect(first.started).toBeGreaterThan(0);expect(first.active).toBeLessThan(66);
 await expect.poll(async()=>(await radio()).stream.state,{timeout:5000}).toBeGreaterThan(0);
 // The queue moves on through the stream, and the dispatcher comes on between the bursts.
 await expect.poll(async()=>(await radio()).banter.length,{timeout:60000}).toBeGreaterThan(0);
 const played=(await radio()).banter[0];expect(played).toBeGreaterThanOrEqual(0);expect(played).toBeLessThanOrEqual(38);
 expect(fetched.length).toBeGreaterThan(1);expect(fetched.every(id=>id>=0&&id<66)).toBe(true);
 // Out of the car, StopRadio: the stream stops and the manager with it.
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>((await state()).fleet?.cars??[]).some((c:any)=>c.modelId===596&&c.occupied),{timeout:20000}).toBe(false);
 await expect.poll(async()=>(await radio()).mode,{timeout:20000}).toBe(7);
 expect((await radio()).stream.state).toBeLessThan(0);
 expect(errors).toEqual([]);
});
