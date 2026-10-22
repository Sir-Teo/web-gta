import {test,expect,type Page} from '@playwright/test';
import RAPIER from '@dimforge/rapier3d-compat';
import {endStoryMission} from './freeRoam';

async function boot(page:Page){
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 await world(page,'setPlayerControl',0,true);
}
function world(page:Page,fn:string,...args:unknown[]){return page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});}
const player=(page:Page)=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.pedPosition(1) as {x:number;y:number;z:number});

test('GIVE creates a controllable RC Bandit without moving or seating CJ, and REMOVE retains its handle through hand-back',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await boot(page);
 const before=await player(page);
 const immediate=await page.evaluate(()=>{
  const m=(window as any).__game.missionForProfiling(),w=m.runtime.world;
  w.setEnableRcDetonate(false);w.setEnableRcDetonateOnContact(false);
  w.giveRemoteControlledModelToPlayer(0,2505,-1680,13.5,180,441);
  return {handle:w.getRemoteControlledCar(0),remote:w.isPlayerInRemoteMode(0)};
 });
 expect(immediate.remote).toBe(true);expect(immediate.handle).toBeGreaterThan(0);
 await page.waitForFunction(h=>(window as any).__game.missionForProfiling().vehicles.entity(h)?.remoteControlled===true,immediate.handle,{timeout:60000});
 const at=()=>page.evaluate(h=>{const m=(window as any).__game.missionForProfiling(),v=m.vehicles.entity(h);return {p:m.vehicles.positionOf(h),occupied:v.occupied,gas:v.gasPedal};},immediate.handle);
 const start=await at();expect(start.occupied).toBe(false);
 await page.keyboard.down('KeyW');
 await expect.poll(async()=>{const p=(await at()).p;return Math.hypot(p.x-start.p.x,p.y-start.p.y);},{timeout:15000}).toBeGreaterThan(2);
 await page.keyboard.up('KeyW');
 const after=await player(page);expect(Math.hypot(after.x-before.x,after.y-before.y,after.z-before.z)).toBeLessThan(.05);
 await world(page,'removeRCBuggy');
 expect(await world(page,'isPlayerInRemoteMode',0)).toBe(true);
 expect(await world(page,'getRemoteControlledCar',0)).toBe(immediate.handle);
 await expect.poll(()=>world(page,'isPlayerInRemoteMode',0),{timeout:15000}).toBe(false);
 expect(await world(page,'getRemoteControlledCar',0)).toBe(-1);
 expect(await page.evaluate(h=>(window as any).__game.missionForProfiling().vehicles.exists(h),immediate.handle)).toBe(false);
 const ended=await player(page);expect(Math.hypot(ended.x-before.x,ended.y-before.y,ended.z-before.z)).toBeLessThan(.1);
 expect(errors).toEqual([]);
});

test('TAKE controls a flying RC Baron, streams its remote focus and keeps CJ at the source',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await boot(page);
 await world(page,'setPedCoordinates',1,370,-1880,6);
 await page.waitForFunction(()=>{const s=(window as any).__game.state();return s.player.grounded&&!s.terrainHold;},undefined,{timeout:90000});
 let before=await player(page);
 const h=await page.evaluate(()=>(window as any).__game.missionForProfiling().vehicles.create(464,{x:370,y:-2380,z:100},0) as number);
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),h,{timeout:60000});
 await world(page,'planeStartsInAir',h);await world(page,'setVehicleForwardSpeed',h,20);
 await world(page,'setEnableRcDetonate',false);await world(page,'setEnableRcDetonateOnContact',false);
 before=await player(page);await world(page,'takeRemoteControlOfCar',0,h);
 await page.waitForFunction(h=>(window as any).__game.missionForProfiling().vehicles.entity(h)?.remoteControlled===true,h);
 const start=await page.evaluate(h=>(window as any).__game.missionForProfiling().vehicles.positionOf(h),h);
 await page.keyboard.down('KeyW');
 await expect.poll(()=>page.evaluate(h=>{const p=(window as any).__game.missionForProfiling().vehicles.positionOf(h);return p.y;},h),{timeout:15000}).toBeGreaterThan(start.y+30);
 await page.keyboard.up('KeyW');
 const probe=await page.evaluate(h=>{
  const g=(window as any).__game,m=g.missionForProfiling(),v=m.vehicles.entity(h),s=g.state();
  const c=g.render().camera.position,p=v.body.translation();
  return {occupied:v.occupied,target:m.runtime.game.camera.targetEntity,player:m.runtime.world.pedPosition(1),following:s.following,radar:s.radar,position:m.vehicles.positionOf(h),cameraGap:Math.hypot(c.x-p.x,c.y-p.y,c.z-p.z)};
 },h);
 expect(Math.hypot(probe.radar.position.x-probe.position.x,probe.radar.position.z+probe.position.y)).toBeLessThan(2);expect(probe.radar.range).toBe(180);
 expect(probe.cameraGap).toBeLessThan(25);expect(probe.occupied).toBe(false);expect(probe.target).toEqual({kind:'vehicle',handle:h});
 expect(Math.hypot(probe.player.x-before.x,probe.player.y-before.y,probe.player.z-before.z)).toBeLessThan(.05);
 // No call to fireAircraft: the real remote input path must fire the RC Baron's nose gun.
 const shots=await page.evaluate(()=>(window as any).__game.weapons().aircraftShots);
 await page.keyboard.down('ControlLeft');
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.weapons().aircraftShots),{timeout:10000}).toBeGreaterThan(shots);
 await page.keyboard.up('ControlLeft');
 await world(page,'setPlayerControl',0,false);await page.keyboard.down('KeyW');
 await expect.poll(()=>page.evaluate(h=>(window as any).__game.missionForProfiling().vehicles.entity(h).throttle,h),{timeout:10000}).toBe(0);
 await page.keyboard.up('KeyW');await world(page,'setPlayerControl',0,true);await world(page,'removeRCBuggy');
 await expect.poll(()=>world(page,'isPlayerInRemoteMode',0),{timeout:15000}).toBe(false);
 await page.waitForFunction(()=>{const s=(window as any).__game.state();return !s.terrainHold&&s.player.grounded;},undefined,{timeout:60000});
 const ended=await player(page);expect(Math.hypot(ended.x-before.x,ended.y-before.y,ended.z-before.z)).toBeLessThan(.1);
 expect(errors).toEqual([]);
});

test('the manual detonation switch consumes a fresh RC fire press without directly killing CJ',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await boot(page);
 await world(page,'setEnableRcDetonate',false);await world(page,'setEnableRcDetonateOnContact',false);
 await world(page,'giveRemoteControlledModelToPlayer',0,2550,-1700,14,0,441);
 const handle=await world(page,'getRemoteControlledCar',0) as number;
 await page.waitForFunction(h=>(window as any).__game.missionForProfiling().vehicles.entity(h)?.remoteControlled===true,handle,{timeout:60000});
 await page.keyboard.down('ControlLeft');await page.waitForTimeout(300);await page.keyboard.up('ControlLeft');
 expect(await page.evaluate(()=>(window as any).__game.missionForProfiling().remote.afterExplosion)).toBe(false);
 expect(await world(page,'vehicleHealth',handle)).toBeGreaterThan(0);
 await page.waitForTimeout(150);await world(page,'setEnableRcDetonate',true);await page.keyboard.down('ControlLeft');
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().remote.afterExplosion),{timeout:10000}).toBe(true);
 await page.keyboard.up('ControlLeft');
 expect(await world(page,'vehicleHealth',handle)).toBe(0);
 expect(await page.evaluate(()=>(window as any).__game.state().player.health)).toBeGreaterThan(0);
 await expect.poll(()=>world(page,'isPlayerInRemoteMode',0),{timeout:15000}).toBe(false);
 expect(errors).toEqual([]);
});

test('the contact switch detonates an RC Bandit at another car wheel independently of the fire switch',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await boot(page);
 const other=await page.evaluate(()=>(window as any).__game.missionForProfiling().vehicles.create(492,{x:2530,y:-1700,z:14},0) as number);
 await page.waitForFunction(h=>(window as any).__game.missionForProfiling().vehicles.entity(h)?.wheelsOnGround>0,other,{timeout:60000});
 await world(page,'setEnableRcDetonate',false);await world(page,'setEnableRcDetonateOnContact',false);
 await world(page,'giveRemoteControlledModelToPlayer',0,2550,-1700,14,0,441);
 const handle=await world(page,'getRemoteControlledCar',0) as number;
 await page.waitForFunction(h=>(window as any).__game.missionForProfiling().vehicles.entity(h)?.remoteControlled===true,handle,{timeout:60000});
 await page.evaluate(({handle,other,fixed})=>{
  const m=(window as any).__game.missionForProfiling(),a=m.vehicles.entity(handle),b=m.vehicles.entity(other);
  // Hold the cars' geometry for the native wheel/box test; a generic collider contact must not be its substitute.
  const point=b.worldPoint(b.car.nativeFramePosition('wheel_lf_dummy'));
  b.car.body.setBodyType(fixed,true);a.car.body.setBodyType(fixed,true);a.car.body.setTranslation(point,true);
 },{handle,other,fixed:RAPIER.RigidBodyType.Fixed});
 await page.waitForTimeout(200);
 expect(await page.evaluate(()=>(window as any).__game.missionForProfiling().remote.afterExplosion)).toBe(false);
 await world(page,'setEnableRcDetonateOnContact',true);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().remote.afterExplosion),{timeout:10000}).toBe(true);
 expect(await world(page,'vehicleHealth',handle)).toBe(0);
 await expect.poll(()=>world(page,'isPlayerInRemoteMode',0),{timeout:15000}).toBe(false);
 expect(errors).toEqual([]);
});

test('ZERO2 hands its RC Baron to player input while CJ stays in the mission van',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await boot(page);
 await page.evaluate(()=>{
  const g=(window as any).__game,m=g.missionForProfiling();
  m.runtime.loadAndLaunchMission(73);
  (window as any).__zeroSkip=setInterval(()=>{if(m.runtime.game.cutscene.running)g.skipCutscene?.();},250);
 });
 await page.waitForFunction(()=>{
  const m=(window as any).__game.missionForProfiling();return m.remote.inRemoteMode&&m.vehicles.entity(m.remote.vehicle)?.remoteControlled;
 },undefined,{timeout:150000});
 await page.evaluate(()=>clearInterval((window as any).__zeroSkip));
 const probe=()=>page.evaluate(()=>{
  const g=(window as any).__game,m=g.missionForProfiling(),h=m.remote.vehicle,v=m.vehicles.entity(h),w=m.runtime.world,c=g.render().camera.position,p=v.body.translation();
  return {h,model:v.modelId,occupied:v.occupied,throttle:v.throttle,position:m.vehicles.positionOf(h),cj:w.pedPosition(1),cjBody:g.sim.playerBody.translation(),ride:w.pedVehicle(1),control:m.playerControl,enabled:v.body.isEnabled(),frozen:v.frozen,velocity:v.body.linvel(),health:v.health,grounded:v.grounded,altitude:v.altitude,
   radar:g.state().radar,target:m.runtime.game.camera.targetEntity,cameraGap:Math.hypot(c.x-p.x,c.y-p.y,c.z-p.z),skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};
 });
 await expect.poll(async()=>(await probe()).control,{timeout:60000}).toBe(true);
 const start=await probe();console.log('ZERO2 handoff',JSON.stringify(start));
 expect(start.grounded).toBe(true);expect(start.altitude).toBeLessThan(2);expect(start.radar.range).toBe(180);expect(Math.hypot(start.radar.position.x-start.position.x,start.radar.position.z+start.position.y)).toBeLessThan(2);expect(start.position.z).toBeGreaterThan(25);expect(start.position.z).toBeLessThan(60);expect(start.model).toBe(464);expect(start.occupied).toBe(false);expect(start.ride).not.toBe(start.h);
 await expect.poll(async()=>(await probe()).cameraGap,{timeout:15000}).toBeLessThan(25);
 await page.keyboard.down('KeyW');
 await expect.poll(async()=>(await probe()).throttle,{timeout:10000}).toBeGreaterThan(0);
 await expect.poll(async()=>{const p=(await probe()).position;return Math.hypot(p.x-start.position.x,p.y-start.position.y);},{timeout:15000}).toBeGreaterThan(5).catch(async error=>{console.log('ZERO2 stalled',JSON.stringify(await probe()));throw error;});
 await page.keyboard.up('KeyW');
 const end=await probe();expect(end.ride).toBe(start.ride);expect(Math.hypot(end.cj.x-start.cj.x,end.cj.y-start.cj.y,end.cj.z-start.cj.z)).toBeLessThan(.1);
 expect(end.gaveUp).toEqual([]);expect(end.skipped).toEqual([]);expect(errors).toEqual([]);
});
