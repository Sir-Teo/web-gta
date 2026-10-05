import {test,expect,type Page} from '@playwright/test';
/** CAEAmbienceTrackManager in the running game, on a saved game (past the opening, whose widescreen holds every
 * ambience track on the iOS port):
 * - with the camera's audio zone a 24/7's (zone 21), the AMBIENCE pack's track 135 streams in, starts quiet and rises to
 *   -6 dB, and is heard; out of the zone it stops. The zone lists are pinned rather than the camera walked into the
 *   store.
 * - on Santa Maria Beach the sea (174) plays; a car's radio takes the stream from it, and on foot again it comes back. */
async function start(page:Page,at:{x:number;y:number;z:number;heading:number}){
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(at=>{localStorage.setItem('web-gta.progress.v1',JSON.stringify({version:1,money:0,savedLocation:{...at,timeMinutes:720}}));},at);
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.state().fadeAlpha),{timeout:90000}).toBe(0);
 await page.waitForFunction(()=>((window as any).__game.missionForProfiling()?.runtime.active.length??0)>2,undefined,{timeout:60000});
 return errors;
}
const audio=(page:Page)=>page.evaluate(()=>(window as any).__game.state().audio);

test('an audio zone plays its ambience track and lets it go',async({page})=>{
 test.setTimeout(180000);
 const fetched:string[]=[];page.on('request',r=>{const u=r.url();if(u.includes('/play/audio/streams/'))fetched.push(u.split('/play/audio/streams/')[1]);});
 const errors=await start(page,{x:2495,y:-1680,z:13.3,heading:1});
 // At Grove Street, in no zone and far from the sea, nothing plays.
 expect((await audio(page)).ambience.status).toBe(0);
 await page.evaluate(()=>{
  const zones=(window as any).__game.missionForProfiling().runtime.game.audioZones;
  const box=zones.boxes.findIndex((b:{id:number;name:string})=>b.id===21);
  zones.update=()=>{};zones.activeSpheres=[];zones.activeBoxes=[box];
 });
 await expect.poll(async()=>(await audio(page)).ambience.track,{timeout:15000}).toBe(135);
 await expect.poll(async()=>(await audio(page)).ambiencePlayed,{timeout:20000}).toBe(1);
 expect(fetched).toContain('track-135.mp3');
 // -6 dB once risen.
 await expect.poll(async()=>(await audio(page)).ambienceGain,{timeout:15000}).toBeCloseTo(10**(-6/20),2);
 await expect.poll(async()=>(await audio(page)).rms,{timeout:5000}).toBeGreaterThan(.0005);
 await page.evaluate(()=>{(window as any).__game.missionForProfiling().runtime.game.audioZones.activeBoxes=[];});
 await expect.poll(async()=>(await audio(page)).ambience.status,{timeout:5000}).toBe(0);
 expect((await audio(page)).ambienceGain).toBeNull();
 expect(errors).toEqual([]);
});

test('the sea plays on the beach, gives way to a car’s radio and comes back on foot',async({page})=>{
 test.setTimeout(240000);
 // On the sand below the boardwalk.
 const errors=await start(page,{x:400,y:-1885,z:6,heading:1});
 await expect.poll(async()=>(await audio(page)).ambience.track,{timeout:20000}).toBe(174);
 await expect.poll(async()=>(await audio(page)).ambience.status,{timeout:20000}).toBe(4);
 const sea=await audio(page);
 expect(sea.ambienceRate).toBe(1);expect(sea.ambienceGain).toBeGreaterThan(0);
 await expect.poll(async()=>(await audio(page)).rms,{timeout:5000}).toBeGreaterThan(.0005);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await page.evaluate(()=>(window as any).__game.spawnVehicle(400));
 await expect.poll(async()=>((await state()).fleet?.cars??[]).some((c:any)=>c.modelId===400),{timeout:30000}).toBe(true);
 await page.waitForTimeout(1500);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>((await state()).fleet?.cars??[]).some((c:any)=>c.modelId===400&&c.occupied),{timeout:20000}).toBe(true);
 // The radio comes on and the sea stops for it (CAERadioTrackManager::StartRadio's StopAmbienceTrack).
 await expect.poll(async()=>(await audio(page)).ambience.status,{timeout:10000}).toBe(0);
 await page.waitForTimeout(2000);
 expect((await audio(page)).ambience.status).toBe(0);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>((await state()).fleet?.cars??[]).some((c:any)=>c.modelId===400&&c.occupied),{timeout:20000}).toBe(false);
 await expect.poll(async()=>(await audio(page)).ambience.track,{timeout:20000}).toBe(174);
 await expect.poll(async()=>(await audio(page)).ambience.status,{timeout:20000}).toBe(4);
 expect(errors).toEqual([]);
});
