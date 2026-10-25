import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('DES3 original passenger warp seats CJ in the transport helicopter without taking its controls',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const h=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=m.runtime.world.pedPosition(1);return m.vehicles.create(417,{x:p.x+10,y:p.y,z:p.z+20},0);});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),h,{timeout:60000});
 // Exact MAIN.SCM instruction at DES3 offset1951143: WARP_CHAR_INTO_CAR_AS_PASSENGER $3 74@ 0.
 const bytes=readFileSync('public/play/world/files/scripts/main.scm'),code=[...bytes.subarray(1951143,1951153),0x4e,0];
 const result=await page.evaluate(({h,code})=>{
  const g=(window as any).__game,m=g.missionForProfiling(),v=m.vehicles.entity(h);m.runtime.world.setHeliBladesFullSpeed(h);m.runtime.world.heliGotoCoords(h,2510,-1687,40,10,40);const pilot={mission:v.heliPilot.mission,destination:[...v.heliPilot.destination]};const slot=m.runtime.start(0,[],{space:new Uint8Array(code),mission:true});
  slot.thread.usesMissionCleanup=false;slot.thread.thisMustBeTheOnlyMissionRunning=false;slot.thread.locals.setInt32(74*4,h,true);
  m.runtime.process(g.gameTimeMs(),0);
  return{pilot,pilotAfter:{mission:v.heliPilot.mission,destination:[...v.heliPilot.destination]},capacity:v.maximumPassengers,passenger:m.runtime.world.pedInPassengerSeat(h,0),free:m.runtime.world.vehiclePassengerSeatIsFree(h,0),count:m.runtime.world.vehiclePassengerCount(h),seat:v.playerPassengerSeat,ride:m.runtime.world.pedVehicle(1),ped:m.runtime.world.pedPosition(1),vehicle:m.runtime.world.vehiclePosition(h),driver:v.occupied,remote:v.remoteControlled,control:m.playerControl,skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};
 },{h,code});
 writeFileSync('artifacts/script-heli-passenger.json',JSON.stringify({h,result,errors},null,2));await page.screenshot({path:'artifacts/script-heli-passenger.png'});
 expect(result.pilotAfter).toEqual(result.pilot);expect(result.capacity).toBeGreaterThan(0);expect(result.seat).toBe(1);expect(result.passenger).toBe(1);expect(result.free).toBe(false);expect(result.count).toBe(1);expect(result.gaveUp).toEqual([]);expect(result.skipped).toEqual([]);expect(result.ride).toBe(h);expect(result.driver).toBe(false);expect(result.remote).toBe(false);expect(errors).toEqual([]);
 const all:any[]=[];
 const state=()=>page.evaluate(h=>{
  const g=(window as any).__game,m=g.missionForProfiling(),v=m.vehicles.entity(h),pose=g.render().vehiclePose,c=g.render().camera.position,b=v?.body.translation(),f=v?.assets.model.frames.find((f:any)=>f.name.toLowerCase()==='ped_frontseat');
  const worldSeat=v&&f?v.worldPoint({x:f.matrix[12],y:f.matrix[13],z:f.matrix[14]}):undefined;
  return{expectedPed:worldSeat?{x:worldSeat.x,y:-worldSeat.z,z:worldSeat.y}:undefined,configuredCameraDistance:g.render().vehicleDistance,cameraDistance:b?Math.hypot(c.x-b.x,c.y-b.y,c.z-b.z):undefined,radius:v?.assets.collision.bounds.radius,ride:m.runtime.world.pedVehicle(1),ped:m.runtime.world.pedPosition(1),vehicle:v?m.runtime.world.vehiclePosition(h):undefined,passenger:m.runtime.world.pedInPassengerSeat(h,0),free:m.runtime.world.vehiclePassengerSeatIsFree(h,0),count:m.runtime.world.vehiclePassengerCount(h),driver:v?.occupied,remote:v?.remoteControlled,seat:v?.playerPassengerSeat,playing:m.runtime.game.vehicleRecordings.isPlaybackGoingOn(h),collider:g.sim.playerCollider.isEnabled(),frozen:g.sim.playerFrozen,pose:pose?{clip:pose.pose.clip,local:pose.frame.local}:undefined,expectedSeat:f?{x:f.matrix[12],y:f.matrix[13],z:f.matrix[14]}:undefined,scene:g.sceneForProfiling(),skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};
 },h);
 const save=async()=>{const final=await state();writeFileSync('artifacts/script-heli-passenger.json',JSON.stringify({h,result,all,final,errors},null,2));return final;};
 try{
  await page.waitForFunction(()=>{const p=(window as any).__game.render().vehiclePose;return p?.pose.clip.toLowerCase()==='car_sitp'&&!!p.frame.local;},undefined,{timeout:30000});
  const seated=await state();all.push({seated});expect(seated.pose?.local).toEqual(seated.expectedSeat);expect(seated.collider).toBe(false);
  await page.evaluate(()=>{const g=(window as any).__game;g.missionForProfiling().runtime.game.vehicleRecordings.requestRecordingFile(530);g.carRecordings().request(530,()=>{});});
  await page.waitForFunction(()=>((window as any).__game.carRecordings().framesOf(530)?.length??0)>0,undefined,{timeout:30000});
  await page.evaluate(h=>(window as any).__game.startCarPlayback(h,530),h);
  await page.waitForFunction(h=>{const g=(window as any).__game,m=g.missionForProfiling(),r=m.runtime.game.vehicleRecordings.playbacks.find((r:any)=>r?.vehicle===h),s=g.sceneForProfiling();return r?.runningTime>1000&&!s.terrainPause&&!s.pendingFollowing&&!s.pendingPrebuild&&!s.installingScene;},h,{timeout:90000});
  const start=await state();await page.keyboard.down('KeyW');await page.waitForTimeout(1200);await page.keyboard.up('KeyW');const moved=await state();all.push({start,moved});await save();expect(moved.configuredCameraDistance).toBe(Math.max(22,moved.radius!*2.5));expect(moved.cameraDistance).toBeGreaterThan(moved.radius!);
  await page.screenshot({path:'artifacts/script-heli-passenger-riding.png'});expect(moved.passenger).toBe(1);expect(moved.count).toBe(1);expect(moved.playing).toBe(true);expect(moved.driver).toBe(false);expect(moved.remote).toBe(false);expect(moved.ride).toBe(h);expect(moved.collider).toBe(false);
  expect(Math.hypot(moved.vehicle!.x-start.vehicle!.x,moved.vehicle!.y-start.vehicle!.y,moved.vehicle!.z-start.vehicle!.z)).toBeGreaterThan(1);
  // GET_CHAR_COORDINATES reads the native seat origin, which is 3.35 units from this helicopter's center.
  expect(Math.hypot(moved.ped.x-moved.expectedPed!.x,moved.ped.y-moved.expectedPed!.y,moved.ped.z-moved.expectedPed!.z)).toBeLessThan(.001);
  await page.evaluate(h=>{const m=(window as any).__game.missionForProfiling(),p=m.runtime.world.vehiclePosition(h);m.runtime.game.vehicleRecordings.setPaused(h,true);m.runtime.world.warpPedFromCarToCoord(1,p.x+10,p.y,p.z+2);},h);
  const out=await state();all.push({out});expect(out.ride).toBeUndefined();expect(out.collider).toBe(true);expect(out.seat).toBe(0);expect(out.passenger).toBe(-1);expect(out.free).toBe(true);expect(out.count).toBe(0);expect(out.playing).toBe(true);
  const deleted=await page.evaluate(h=>{const g=(window as any).__game,m=g.missionForProfiling(),w=m.runtime.world;w.warpPedIntoCarAsPassenger(1,h,0);const aboard=w.pedVehicle(1);w.deleteVehicle(h);return{aboard,ride:w.pedVehicle(1),collider:g.sim.playerCollider.isEnabled(),frozen:g.sim.playerFrozen};},h);
  all.push({deleted});expect(deleted.aboard).toBe(h);expect(deleted.ride).toBeUndefined();expect(deleted.collider).toBe(true);expect(deleted.frozen).toBe(false);
  const final=await save();expect(final.gaveUp).toEqual([]);expect(final.skipped).toEqual([]);expect(errors).toEqual([]);
 }catch(error){await page.keyboard.up('KeyW');await save();await page.screenshot({path:'artifacts/script-heli-passenger-failure.png'});throw error;}

});
