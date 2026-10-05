import {test,expect} from '@playwright/test';
/** Mission dialogue and the mission-passed tune, from the iOS port's SCRIPT and BEATS packs, through the script host
 * the missions use: LOAD_MISSION_AUDIO streams INTRO1's first line (sample 20000, bank 237) and holds the slot loading
 * until it has decoded, PLAY_MISSION_AUDIO plays it for its own length, and PLAY_MISSION_PASSED_TUNE plays track 183. */
test('a mission line and the mission-passed tune play from the published packs',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const fetched:string[]=[];page.on('request',r=>{const u=r.url();if(/play\/audio\/(script|streams)\//.test(u))fetched.push(u.split('/play/audio/')[1]);});
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.scm()?.started??false),{timeout:30000}).toBe(true);
 const audio=()=>page.evaluate(()=>(window as any).__game.state().audio);
 await expect.poll(async()=>(await audio()).context,{timeout:15000}).toBe('running');
 // The opening plays no dialogue of its own, so nothing of the pack has been fetched yet.
 expect(fetched).toEqual([]);
 // The opening fades the screen out, and CAEAudioHardware's fader scales every sound with it: a line is heard once
 // the screen is up, as a mission's are.
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.state().fadeAlpha),{timeout:90000}).toBe(0);
 // A free slot, as a mission's LOAD_MISSION_AUDIO leaves it, then the host's load.
 const slot=4,sample=20000;
 await page.evaluate(({slot,sample})=>{const r=(window as any).__game.missionForProfiling().runtime;r.game.missionAudio.preload(slot,sample);r.world.loadMissionAudio(slot,sample);},{slot,sample});
 await expect.poll(async()=>await page.evaluate(slot=>(window as any).__game.missionForProfiling().runtime.game.missionAudio.hasLoaded(slot),slot),{timeout:30000}).toBe(true);
 expect(fetched).toEqual(['script/script.json','script/bank-237.bin']);
 const length=await page.evaluate(({slot,sample})=>{
  const r=(window as any).__game.missionForProfiling().runtime,ms=r.world.missionAudioLengthMs(sample,undefined);
  if(r.game.missionAudio.play(slot,ms))r.world.playMissionAudio(slot);return ms;
 },{slot,sample});
 // INTRO1's first line runs 3.84 seconds.
 expect(length).toBeGreaterThan(3800);expect(length).toBeLessThan(3900);
 await expect.poll(async()=>(await audio()).speechPlayed).toBe(1);
 await expect.poll(async()=>(await audio()).rms,{timeout:5000}).toBeGreaterThan(.0005);
 await expect.poll(async()=>await page.evaluate(slot=>(window as any).__game.missionForProfiling().runtime.game.missionAudio.hasFinished(slot),slot),{timeout:15000}).toBe(true);
 await page.evaluate(slot=>{const r=(window as any).__game.missionForProfiling().runtime;r.game.missionAudio.clear(slot);r.world.clearMissionAudio(slot);},slot);
 expect((await audio()).speechVoices).toBe(0);
 // Tune 1, every story mission's pass.
 await page.evaluate(()=>{(window as any).__game.missionForProfiling().runtime.world.playMissionPassedTune(1);});
 await expect.poll(async()=>(await audio()).tracksPlayed,{timeout:15000}).toBe(1);
 expect(fetched).toContain('streams/track-183.mp3');
 expect((await audio()).trackPlaying).toBe(true);
 await expect.poll(async()=>(await audio()).rms,{timeout:5000}).toBeGreaterThan(.0005);
 expect(errors).toEqual([]);
});
