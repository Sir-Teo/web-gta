import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CVehicleRecording: REQUEST_CAR_RECORDING streams the file from carrec.img, and a playback puts the car on the
 * recording each frame, between the frames either side of its clock. INTRO waits on files 706 and 707. */
test('a script car plays back a recording streamed from carrec.img',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.game.vehicleRecordings.requestRecordingFile(706));
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.game.vehicleRecordings.hasRecordingFileBeenLoaded(706)),{timeout:30000}).toBe(true);
 const start=await page.evaluate(()=>(window as any).__game.carRecordings().framesOf(706)[0].position);
 const car=await page.evaluate(p=>(window as any).__game.missionForProfiling().vehicles.create(596,{x:p[0],y:p[1],z:p[2]},0),start);
 await page.waitForFunction(c=>!!(window as any).__game.missionForProfiling().vehicles.entity(c),car,{timeout:60000});
 expect(await page.evaluate(c=>(window as any).__game.startCarPlayback(c,706),car)).toBe(0);
 // Sampled over the playback: the car is where the recording is at its clock.
 const samples:{d:number;t:number;drawn:number}[]=[];
 for(let k=0;k<6;k++){
  await page.waitForTimeout(1500);
  const s=await page.evaluate(c=>{const g=(window as any).__game,m=g.missionForProfiling(),p=m.runtime.game.vehicleRecordings.playbacks[0];if(!p)return undefined;
   const f=g.carRecordings().framesOf(706);let i=0;while(i+2<f.length&&f[i+1].time<=p.runningTime)i++;
   const a=f[i],b=f[i+1],u=Math.min(1,Math.max(0,(p.runningTime-a.time)/(b.time-a.time)));
   const want=[0,1,2].map(j=>a.position[j]*(1-u)+b.position[j]*u),at=m.vehicles.positionOf(c);
   // What is drawn: the render root, interpolated from where the step began to the body.
   const e=m.vehicles.entity(c),root=e.car.root.position,body=e.car.body.translation();
   return {t:p.runningTime,d:Math.hypot(at.x-want[0],at.y-want[1],at.z-want[2]),drawn:Math.hypot(root.x-body.x,root.y-body.y,root.z-body.z)};},car);
  if(s)samples.push(s);
 }
 expect(samples.length).toBeGreaterThan(2);
 expect(samples.at(-1)!.t).toBeGreaterThan(samples[0].t);
 // Within a few units: a frame's worth of the car's own motion between the sample and the render.
 for(const s of samples)expect(s.d).toBeLessThan(4);
 // The car is drawn where it is, not part way back to where the playback took it over (its step skipped the pose the
 // render interpolates from, so INTRO's police car was drawn trailing, low and turning early).
 for(const s of samples)expect(s.drawn).toBeLessThan(1);
 expect(errors).toEqual([]);
});
