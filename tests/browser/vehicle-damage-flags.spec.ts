import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('script damage flags and attacker queries reach live car, bike, boat and aircraft shots',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 // Hold an isolated arena above the streamed terrain so every shot has a clear ray and no traffic victim.
 const base=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),w=m.runtime.world,p=w.pedPosition(1),base={x:p.x,y:p.y,z:p.z+20};w.setPedCoordinates(1,base.x,base.y,base.z);w.freezePedPosition(1,true);w.givePedWeapon(1,31,1000);w.setPedCurrentWeapon(1,31);return base;});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.weapons().ready),{timeout:30000}).toBe(true);
 for(const model of[400,481,454,487,511]){
  const h=await page.evaluate(({model,base})=>{const m=(window as any).__game.missionForProfiling();return m.vehicles.create(model,{x:base.x+15,y:base.y,z:base.z+1},0);},{model,base});
  await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),h,{timeout:60000});
  await page.evaluate(h=>{const m=(window as any).__game.missionForProfiling(),w=m.runtime.world;w.freezeVehiclePosition(h,true);w.setVehicleCanBeDamaged(h,false);},h);
  await page.waitForTimeout(600);await expect.poll(()=>page.evaluate(h=>(window as any).__game.missionForProfiling().vehicles.entity(h).car.body.isEnabled(),h),{timeout:10000}).toBe(true);
  const read=()=>page.evaluate(h=>{const w=(window as any).__game.missionForProfiling().runtime.world;return{health:w.vehicleHealth(h),weapon:w.vehicleLastWeaponDamage(h),player:w.vehicleWasDamagedByPed(h,1)};},h);
  const shoot=async()=>{await page.waitForTimeout(250);return page.evaluate(h=>{const g=(window as any).__game,v=g.missionForProfiling().vehicles.entity(h),p=v.car.body.collider(0).translation();return g.fireAt(p.x,p.y,p.z);},h);};
  const initial=await read();expect(initial.weapon).toBe(-1);expect(initial.player).toBe(false);
  expect(await shoot()).toBe(true);expect(await read()).toEqual(initial);
  await page.evaluate(h=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.setVehicleCanBeDamaged(h,true);w.setVehicleProofs(h,{bullet:true,fire:false,explosion:false,collision:false,melee:false});},h);
  expect(await shoot()).toBe(true);expect(await read()).toEqual(initial);
  await page.evaluate(h=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.setVehicleProofs(h,{bullet:false,fire:false,explosion:false,collision:false,melee:false});w.setVehicleOnlyDamagedByPlayer(h,true);},h);
  await expect.poll(async()=>{expect(await shoot()).toBe(true);return(await read()).health;},{timeout:8000,message:`model ${model} accepts a live round after its proofs clear`}).toBeLessThan(initial.health);const hit=await read();expect(hit.weapon).toBe(31);expect(hit.player).toBe(true);
  await page.evaluate(h=>{const m=(window as any).__game.missionForProfiling(),w=m.runtime.world;w.clearVehicleLastDamageEntity(h);w.clearCarLastWeaponDamage(h);m.vehicles.delete(h);},h);
 }
 await page.evaluate(()=>{(window as any).__game.missionForProfiling().runtime.world.freezePedPosition(1,false);});expect(errors).toEqual([]);
});
