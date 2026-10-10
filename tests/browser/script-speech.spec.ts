import {test,expect} from '@playwright/test';
/** Mission dialogue and the mission-passed tune, from the iOS port's SCRIPT and BEATS packs, through the script host
 * the missions use: LOAD_MISSION_AUDIO streams INTRO1's first line (sample 20000, bank 237) and holds the slot loading
 * until it has decoded, PLAY_MISSION_AUDIO plays it for its own length, PLAY_MISSION_PASSED_TUNE plays track 183, and a dance's
 * beat track is heard with its beats read off the audio's clock. */
test('a mission line and the mission-passed tune play from the published packs',async({page})=>{
 test.setTimeout(360000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const fetched:string[]=[];page.on('request',r=>{const u=r.url();if(/play\/audio\/(script|streams)\//.test(u))fetched.push(u.split('/play/audio/')[1]);});
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.scm()?.started??false),{timeout:30000}).toBe(true);
 const audio=()=>page.evaluate(()=>(window as any).__game.state().audio);
 await expect.poll(async()=>(await audio()).context,{timeout:15000}).toBe('running');
 // The opening plays no dialogue of its own, so nothing of the SCRIPT pack has been fetched yet. Its two cutscenes'
 // tracks play (PROLOG1's 706, PROLOG3's 708), and then INTRO preloads and plays beat track 10, stream track 184, its
 // own music.
 expect(fetched.filter(f=>f.startsWith('script/'))).toEqual([]);
 await expect.poll(()=>fetched.includes('streams/track-706.mp3'),{timeout:30000}).toBe(true);
 await expect.poll(()=>fetched.includes('streams/track-184.mp3'),{timeout:180000}).toBe(true);
 // The opening fades the screen out, and CAEAudioHardware's fader scales every sound with it: a line is heard once
 // the screen is up, as a mission's are.
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.state().fadeAlpha),{timeout:90000}).toBe(0);
 // A free speech slot (1 or 2: the slots the scripts speak in, whose lines EVENTVOL marks -128 and
 // PlayLoadedMissionAudio plays at +6 dB), as a mission's LOAD_MISSION_AUDIO leaves it, then the host's load.
 const slot=2,sample=20000;
 await page.evaluate(({slot,sample})=>{const r=(window as any).__game.missionForProfiling().runtime;r.game.missionAudio.preload(slot,sample);r.world.loadMissionAudio(slot,sample);},{slot,sample});
 await expect.poll(async()=>await page.evaluate(slot=>(window as any).__game.missionForProfiling().runtime.game.missionAudio.hasLoaded(slot),slot),{timeout:30000}).toBe(true);
 expect(fetched.filter(f=>f.startsWith('script/'))).toEqual(['script/script.json','script/bank-237.bin']);
 const length=await page.evaluate(({slot,sample})=>{
  const r=(window as any).__game.missionForProfiling().runtime,ms=r.world.missionAudioLengthMs(sample,undefined);
  if(r.game.missionAudio.play(slot,ms))r.world.playMissionAudio(slot);return ms;
 },{slot,sample});
 // INTRO1's first line runs 3.84 seconds.
 expect(length).toBeGreaterThan(3800);expect(length).toBeLessThan(3900);
 await expect.poll(async()=>(await audio()).speechPlayed).toBe(1);
 // CAEScriptAudioEntity's link plays it: no point or entity, so ahead of the listener, at +6 dB.
 expect((await audio()).native.script.links[slot-1]).toMatchObject({event:sample,playing:true,frontEnd:true,volume:6});
 await expect.poll(async()=>(await audio()).rms,{timeout:5000}).toBeGreaterThan(.0005);
 await expect.poll(async()=>await page.evaluate(slot=>(window as any).__game.missionForProfiling().runtime.game.missionAudio.hasFinished(slot),slot),{timeout:15000}).toBe(true);
 await page.evaluate(slot=>{const r=(window as any).__game.missionForProfiling().runtime;r.game.missionAudio.clear(slot);r.world.clearMissionAudio(slot);},slot);
 expect((await audio()).speechVoices).toBe(0);
 // ATTACH_MISSION_AUDIO_TO_CHAR on the player after the load: the line follows him instead of playing ahead.
 await page.evaluate(({slot,sample})=>{const r=(window as any).__game.missionForProfiling().runtime;r.game.missionAudio.preload(slot,sample);r.world.loadMissionAudio(slot,sample);},{slot,sample});
 await expect.poll(async()=>await page.evaluate(slot=>(window as any).__game.missionForProfiling().runtime.game.missionAudio.hasLoaded(slot),slot),{timeout:30000}).toBe(true);
 await page.evaluate(({slot,sample})=>{const r=(window as any).__game.missionForProfiling().runtime;r.game.missionAudio.attach(slot,'ped',1);
  if(r.game.missionAudio.play(slot,r.world.missionAudioLengthMs(sample,undefined)))r.world.playMissionAudio(slot);},{slot,sample});
 await expect.poll(async()=>(await audio()).native.script.links[slot-1],{timeout:5000}).toMatchObject({event:sample,playing:true,frontEnd:false,following:true});
 await page.evaluate(slot=>{const r=(window as any).__game.missionForProfiling().runtime;r.game.missionAudio.clear(slot);r.world.clearMissionAudio(slot);},slot);
 expect((await audio()).native.script.links[slot-1].playing).toBe(false);
 // Tune 1, every story mission's pass: PLAY_MISSION_PASSED_TUNE preloads beat track 11 and plays it.
 const track=()=>page.evaluate(()=>{const t=(window as any).__game.missionForProfiling().runtime.game.cutsceneTrack;return {status:t.reportedStatus,id:t.trackId};});
 const before=(await audio()).tracksPlayed;
 await page.evaluate(()=>{const t=(window as any).__game.missionForProfiling().runtime.game.cutsceneTrack;t.preloadBeatTrack(11);t.play();});
 await expect.poll(async()=>(await audio()).tracksPlayed,{timeout:15000}).toBe(before+1);
 expect(fetched).toContain('streams/track-183.mp3');
 expect(await track()).toEqual({status:3,id:183});
 await expect.poll(async()=>(await audio()).rms,{timeout:5000}).toBeGreaterThan(.0005);
 // The tune runs its 9.1 seconds and the track manager lets it go.
 await expect.poll(async()=>(await track()).status,{timeout:20000}).toBe(0);
 // A dance's beat track: GET_BEAT_PROXIMITY reads TRKHEAD.DAT's beats against the audio's own clock. Track 175's
 // first beat is at 18.328 s; a second in, it is the next beat, about 17.3 s off.
 await page.evaluate(()=>{const t=(window as any).__game.missionForProfiling().runtime.game.cutsceneTrack;t.preloadBeatTrack(1);t.play();});
 await expect.poll(async()=>(await track()).status,{timeout:15000}).toBe(3);
 await page.waitForTimeout(1000);
 const beat=await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.game.cutsceneTrack.beatProximity(1));
 expect(beat.key).toBe(4);expect(beat.number).toBe(0);
 expect(beat.time).toBeGreaterThan(15000);expect(beat.time).toBeLessThan(17700);
 await page.evaluate(()=>{(window as any).__game.missionForProfiling().runtime.game.cutsceneTrack.stop();});
 await expect.poll(async()=>(await track()).status).toBe(0);
 expect((await audio()).trackPlaying).toBe(false);
 expect(errors).toEqual([]);
});
