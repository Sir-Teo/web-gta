import {test,expect} from '@playwright/test';
/** CAEAmbienceTrackManager in the running game: with the camera's audio zone a 24/7's (zone 21), the AMBIENCE pack's
 * track 135 streams in, starts quiet and rises to -6 dB, and is heard; out of the zone it fades away and stops. The
 * zone lists are pinned rather than the camera walked into the store, and INTRO's own beat track is stopped first,
 * as a playing beat track holds the ambience. */
test('an audio zone plays its ambience track and lets it go',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const fetched:string[]=[];page.on('request',r=>{const u=r.url();if(u.includes('/play/audio/streams/'))fetched.push(u.split('/play/audio/streams/')[1]);});
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.scm()?.started??false),{timeout:30000}).toBe(true);
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.state().fadeAlpha),{timeout:90000}).toBe(0);
 const audio=()=>page.evaluate(()=>(window as any).__game.state().audio);
 // Outside every zone nothing plays.
 expect((await audio()).ambience.status).toBe(0);
 await page.evaluate(()=>{
  const g=(window as any).__game.missionForProfiling().runtime.game,zones=g.audioZones;
  g.cutsceneTrack.stop();
  const box=zones.boxes.findIndex((b:{id:number;name:string})=>b.id===21);
  zones.update=()=>{};zones.activeSpheres=[];zones.activeBoxes=[box];
 });
 await expect.poll(async()=>(await audio()).ambience.track,{timeout:15000}).toBe(135);
 await expect.poll(async()=>(await audio()).ambiencePlayed,{timeout:20000}).toBe(1);
 expect(fetched).toContain('track-135.mp3');
 // -6 dB once risen.
 await expect.poll(async()=>(await audio()).ambienceGain,{timeout:15000}).toBeCloseTo(10**(-6/20),2);
 await expect.poll(async()=>(await audio()).rms,{timeout:5000}).toBeGreaterThan(.0005);
 await page.evaluate(()=>{(window as any).__game.missionForProfiling().runtime.game.audioZones.activeBoxes=[];});
 await expect.poll(async()=>(await audio()).ambience.status,{timeout:20000}).toBe(0);
 expect((await audio()).ambienceGain).toBeNull();
 expect(errors).toEqual([]);
});
