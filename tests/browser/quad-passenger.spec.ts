import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

for(const modelId of [471,461])test(`CJ rides the native ${modelId===471?'quad':'PCJ-600'} pillion without taking its driver controls`,async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);
 const car=await page.evaluate(modelId=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().vehicles.create(modelId,{x:p.x+8,y:-p.z,z:p.y+1},0);},modelId);
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),car,{timeout:45000});
 const model=await page.evaluate(car=>{const g=(window as any).__game,m=g.missionForProfiling(),v=m.vehicles.entity(car);m.runtime.world.freezeVehiclePosition(car,true);const driver=m.peds.createInCar(4,'MALE01',car,'driver');return {body:v.body.handle,type:v.assets.vehicle.type,capacity:v.maximumPassengers,front:v.seat(),back:v.backSeat(),block:v.riderPose().block,driver};},car);
 expect(model.capacity).toBe(1);expect(model.back).toBeDefined();expect(Math.abs(model.front.y-model.back.y)).toBeGreaterThan(.3);
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),model.driver,{timeout:30000});
 await page.evaluate(car=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCarAsPassenger(1,car,0),car);
 await page.waitForFunction(block=>(window as any).__game.render().vehiclePose?.pose.clip===`${block}_passenger`,model.block,{timeout:30000});
 const state=()=>page.evaluate(async car=>{
  const path='/tests/fixtures/native-render-dependencies.ts',{THREE}=await import(/* @vite-ignore */ path),g=(window as any).__game,m=g.missionForProfiling(),v=m.vehicles.entity(car),local=v.car.root.worldToLocal(g.render().nativeCharacter.root.getWorldPosition(new THREE.Vector3()));
  return {local:{x:local.x,y:local.y,z:local.z},frame:g.render().vehiclePose?.frame.local,clip:g.render().vehiclePose?.pose.clip,driver:v.occupied,seat:v.playerPassengerSeat,collider:g.sim.playerCollider.isEnabled(),vehicle:m.runtime.world.pedVehicle(1),pilot:m.runtime.world.vehicleDriver(car),passenger:m.runtime.world.pedInPassengerSeat(car,0),free:m.runtime.world.vehiclePassengerSeatIsFree(car,0),count:m.runtime.world.vehiclePassengerCount(car),player:{...g.sim.player.position},body:{...v.body.translation()},autopilot:v.autopilot};
 },car);
 const check=(p:any)=>{expect(p.frame).toEqual(model.back);expect(p.local.x).toBeCloseTo(model.back.x,5);expect(p.local.y).toBeCloseTo(model.back.z,5);expect(p.local.z).toBeCloseTo(-model.back.y,5);expect(p).toMatchObject({driver:false,seat:1,collider:false,vehicle:car,pilot:model.driver,passenger:1,free:false,count:1});};
 const player=await state();check(player);
 await page.evaluate(car=>{const v=(window as any).__game.missionForProfiling().vehicles.entity(car),p=v.body.translation();v.body.setTranslation({x:p.x+5,y:p.y,z:p.z+3},true);v.autopilot={throttle:.3,steer:.1,brake:false};},car);
 await page.keyboard.down('KeyW');await page.waitForTimeout(300);await page.keyboard.up('KeyW');
 const moved=await state();check(moved);expect(moved.autopilot).toMatchObject({throttle:.3,steer:.1});expect(moved.player.x).toBeCloseTo(moved.body.x,4);expect(moved.player.z).toBeCloseTo(moved.body.z,4);expect(moved.body.x-player.body.x).toBeCloseTo(5,3);
 await page.screenshot({path:`artifacts/bike-passenger-${modelId}.png`});
 const out=await page.evaluate(car=>{const g=(window as any).__game,m=g.missionForProfiling(),w=m.runtime.world,p=w.vehiclePosition(car);w.warpPedFromCarToCoord(1,p.x+4,p.y,p.z);return {collider:g.sim.playerCollider.isEnabled(),vehicle:w.pedVehicle(1),seat:m.vehicles.entity(car).playerPassengerSeat,pilot:w.vehicleDriver(car),count:w.vehiclePassengerCount(car)};},car);
 expect(out).toEqual({collider:true,vehicle:undefined,seat:0,pilot:model.driver,count:0});
 const ejected=await page.evaluate(car=>{const g=(window as any).__game,m=g.missionForProfiling(),v=m.vehicles.entity(car);m.runtime.world.warpPedIntoCarAsPassenger(1,car,0);return {accepted:v.explosionKnockOff(),seat:v.playerPassengerSeat,collider:g.sim.playerCollider.isEnabled(),airborne:!g.sim.player.grounded,verticalSpeed:g.sim.player.verticalSpeed,push:{...g.sim.collisionPush},pilot:m.runtime.world.vehicleDriver(car)};},car);
 expect(ejected).toMatchObject({accepted:true,seat:0,collider:true,airborne:true,pilot:model.driver});expect(ejected.verticalSpeed).toBeGreaterThan(3);expect(Math.hypot(ejected.push.x,ejected.push.z)).toBeGreaterThan(4);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.pedVehicle(1)??null)).toBeNull();
 expect(await page.evaluate(()=>(window as any).__game.render().vehiclePose?.pose.clip??'')).not.toMatch(/_passenger$/);
 const cleanup=await page.evaluate(car=>{const g=(window as any).__game,m=g.missionForProfiling(),w=m.runtime.world;w.warpPedIntoCarAsPassenger(1,car,0);const aboard=w.pedVehicle(1);w.deleteVehicle(car);return {aboard,collider:g.sim.playerCollider.isEnabled(),vehicle:w.pedVehicle(1),skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};},car);
 expect(cleanup).toEqual({aboard:car,collider:true,vehicle:undefined,skipped:[],gaveUp:[]});expect(errors).toEqual([]);
 writeFileSync(`artifacts/bike-passenger-${modelId}.json`,JSON.stringify({model,player,moved,out,ejected,cleanup,errors},null,2));
});
