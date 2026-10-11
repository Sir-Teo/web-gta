import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CVehicleRecording plays an aircraft's recording as a car's. DRUGS4 makes its police Maverick, starts recording 352
 * on it, pauses it and waits for the playback to be going on before its camera follows the helicopter in; the browser
 * stopped a helicopter's playback on its first frame (no recorded body), and the mission waited forever. */
test('a helicopter flies its recording, and a paused playback is still going on',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 // Near the motel, where DRUGS4 makes it.
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.setPedCoordinates(1,2224,-1150,26));
 // The game clock (and with it the playback's) waits while the ground there streams in.
 await page.waitForFunction(()=>{const s=(window as any).__game.state();return s.player.grounded&&!s.terrainHold;},undefined,{timeout:60000});
 await page.waitForTimeout(1000);
 const heli=await page.evaluate(()=>(window as any).__game.missionForProfiling().vehicles.create(497,{x:2227.03,y:-1130.2,z:25.3},0));
 await page.waitForFunction((h:number)=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),heli,{timeout:60000});
 const going=()=>page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.game.vehicleRecordings.isPlaybackGoingOn(h),heli);
 const where=()=>page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.vehiclePosition(h),heli);
 // REQUEST_CAR_RECORDING and the wait on HAS_CAR_RECORDING_BEEN_LOADED, as the mission makes them.
 await page.evaluate(()=>{const g=(window as any).__game;g.missionForProfiling().runtime.game.vehicleRecordings.requestRecordingFile(352);g.carRecordings().request(352,()=>{});});
 await page.waitForFunction(()=>((window as any).__game.carRecordings().framesOf(352)?.length??0)>0,undefined,{timeout:30000});
 const slot=await page.evaluate(h=>(window as any).__game.startCarPlayback(h,352),heli);
 expect(slot).toBeGreaterThanOrEqual(0);
 const start=await where();await page.waitForTimeout(1500);
 expect(await going()).toBe(true);
 const moved=await where();
 expect(Math.hypot(moved.x-start.x,moved.y-start.y,moved.z-start.z)).toBeGreaterThan(1);
 // PAUSE_PLAYBACK_RECORDED_CAR: held where it is, and still going on.
 await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.game.vehicleRecordings.setPaused(h,true),heli);
 const held=await where();await page.waitForTimeout(800);
 expect(await going()).toBe(true);
 const still=await where();
 expect(Math.hypot(still.x-held.x,still.y-held.y,still.z-held.z)).toBeLessThan(.5);
 expect(errors).toEqual([]);
});
