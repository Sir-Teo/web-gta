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

test('station skip follows a caboose to its engine, bypasses locked cities and advances the clock',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const train=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling();m.runtime.game.stats.set(181,0);return m.runtime.world.createMissionTrain(10,-1944.1,139.877,24.7148,true);});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),train,{timeout:60000});
 const result=await page.evaluate(h=>{
  const g=(window as any).__game,m=g.missionForProfiling(),w=m.runtime.world,v=m.vehicles.entity(h),fleet=g.fleet(),caboose=w.getTrainCaboose(h);
  const locked=!w.isNextStationAllowed(h),distance=fleet.stationDist[2],old=v.carriage.position.slice(),before=g.sim.timeMinutes;
  const expectedMinutes=Math.trunc(23+Math.hypot(Math.fround(1725.12)-old[0],Math.fround(-1953.81)-old[1])/20),cj={...g.sim.player.position};
  w.skipTrainToNextStation(caboose);
  return {locked,caboose,railDistance:v.carriage.railDistance,speed:v.carriage.speed,expectedDistance:Math.fround(distance-20),minutes:(g.sim.timeMinutes-before+1440)%1440,expectedMinutes,cj};
 },train);
 expect(result.locked).toBe(true);expect(result.caboose).toBeGreaterThan(0);
 expect(result.railDistance).toBe(result.expectedDistance);expect(result.speed).toBe(Math.fround(.1));expect(result.minutes).toBeCloseTo(result.expectedMinutes,6);
 await expect.poll(()=>page.evaluate(h=>{const p=(window as any).__game.missionForProfiling().vehicles.positionOf(h);return Math.hypot(p.x-1725.12,p.y+1953.81);},train),{timeout:15000}).toBeLessThan(50);
 const end=await page.evaluate(({h,caboose})=>{const g=(window as any).__game,m=g.missionForProfiling(),a=m.vehicles.positionOf(h),b=m.vehicles.positionOf(caboose);return {gap:Math.hypot(a.x-b.x,a.y-b.y),cj:g.sim.player.position};},{h:train,caboose:result.caboose});
 expect(end.gap).toBeGreaterThan(10);expect(end.gap).toBeLessThan(25);
 expect(Math.hypot(end.cj.x-result.cj.x,end.cj.y-result.cj.y,end.cj.z-result.cj.z)).toBeLessThan(.1);expect(errors).toEqual([]);
});
