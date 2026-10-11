import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CTrain for CREATE_MISSION_TRAIN: the type's carriages on the nearest track (type 10: a freight engine and one flat
 * car, as RYDER3 makes it), drawn up to the cruise speed along the rails, the carriage a car's length behind. */
test('a mission train runs along its track at its cruise speed',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const train=await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.createMissionTrain(10,2278.18,-1144.88,27.51,true));
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),train,{timeout:60000});
 const carriage=await page.evaluate(h=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.setTrainSpeed(h,10);w.setTrainCruiseSpeed(h,20);return w.trainCarriage(h,1);},train);
 expect(carriage).toBeGreaterThan(0);
 const read=()=>page.evaluate(({h,c})=>{const m=(window as any).__game.missionForProfiling(),w=m.runtime.world;
  return {engine:m.vehicles.positionOf(h),carriage:m.vehicles.positionOf(c),isTrain:w.vehicleIsTrain(h),none:w.trainCarriage(h,5),clockwise:w.findTrainDirection(h)};},{h:train,c:carriage});
 const first=await read();
 expect(first.isTrain).toBe(true);expect(first.none).toBe(-1);expect(first.clockwise).toBe(true);
 // On the rails near where it was asked for, and a flat car's length behind the engine.
 expect(Math.hypot(first.engine.x-2278.18,first.engine.y+1144.88)).toBeLessThan(40);
 const gap=Math.hypot(first.engine.x-first.carriage.x,first.engine.y-first.carriage.y);
 expect(gap).toBeGreaterThan(10);expect(gap).toBeLessThan(25);
 // ADD_BLIP_FOR_CAR on the engine (SCRASH2 follows its train so): its cone stands over the carriage's box, which the
 // marker read from a car's assets and threw on every frame.
 await page.evaluate(h=>{const r=(window as any).__game.missionForProfiling().runtime;r.game.radar.setEntityBlip(1,h,3);},train);
 await page.waitForTimeout(6000);
 const markers=await page.evaluate(()=>(window as any).__game.missionForProfiling().radarMarkers(false));
 expect(markers.some((m:any)=>m.kind==='cone')).toBe(true);
 const later=await read();
 expect(Math.hypot(later.engine.x-first.engine.x,later.engine.y-first.engine.y)).toBeGreaterThan(5);
 const gapLater=Math.hypot(later.engine.x-later.carriage.x,later.engine.y-later.carriage.y);
 expect(Math.abs(gapLater-gap)).toBeLessThan(3);
 await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.deleteMissionTrain(h),train);
 expect(await page.evaluate(h=>(window as any).__game.missionForProfiling().vehicles.exists(h),train)).toBe(false);
 expect(errors).toEqual([]);
});
