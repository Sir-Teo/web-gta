import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CAutomobile::VehicleDamage: a car another vehicle crashes into keeps it as m_pLastDamageEntity, by
 * WEAPON_RAMMEDBYCAR. HAS_CAR_BEEN_DAMAGED_BY_CAR names it, HAS_CAR_BEEN_DAMAGED_BY_CHAR does not name the player,
 * and CLEAR_CAR_LAST_DAMAGE_ENTITY forgets it. */
test('a script car rammed by another knows which car hit it',async({page})=>{
 test.setTimeout(240000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 // Two cars on Grove Street, facing west (a heading of 90), one behind the other.
 const made=await page.evaluate(()=>{
  const game=(window as any).__game,m=game.missionForProfiling(),p=game.state().player.position;
  const struck=m.vehicles.create(400,{x:p.x+8,y:-p.z,z:p.y},90),rammer=m.vehicles.create(400,{x:p.x+16,y:-p.z,z:p.y},90);
  return {struck,rammer};
 });
 await page.waitForFunction(({struck,rammer})=>{const m=(window as any).__game.missionForProfiling();return !!(m.vehicles.entity(struck)&&m.vehicles.entity(rammer));},made,{timeout:45000});
 const world=(fn:string,...args:number[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 expect(await world('vehicleLastWeaponDamage',made.struck)).toBe(-1);
 expect(await world('vehicleWasDamagedByVehicle',made.struck,made.rammer)).toBe(false);
 // The rammer goes at the struck car at 15 m/s, west (browser -x).
 await page.evaluate(({rammer})=>{const car=(window as any).__game.missionForProfiling().vehicles.entity(rammer);car.car.body.setLinvel({x:-15,y:0,z:0},true);},made);
 await expect.poll(()=>world('vehicleWasDamagedByVehicle',made.struck,made.rammer),{timeout:10000}).toBe(true);
 expect(await world('vehicleLastWeaponDamage',made.struck)).toBe(49);
 expect(await world('vehicleWasDamagedByPed',made.struck,1)).toBe(false);
 await world('clearVehicleLastDamageEntity',made.struck);
 expect(await world('vehicleWasDamagedByVehicle',made.struck,made.rammer)).toBe(false);
 // The weapon stays until CLEAR_CAR_LAST_WEAPON_DAMAGE.
 expect(await world('vehicleLastWeaponDamage',made.struck)).toBe(49);
 await world('clearCarLastWeaponDamage',made.struck);
 expect(await world('vehicleLastWeaponDamage',made.struck)).toBe(-1);
 expect(errors).toEqual([]);
});
