import {test,expect} from '@playwright/test';
/** Mission world adapters the campaign's threads reach: IS_POINT_ON_SCREEN, WARP_CHAR_INTO_CAR_AS_PASSENGER with
 * GET_CAR_CHAR_IS_USING, the speech switches and GET_OFFSET_FROM_CHAR_IN_WORLD_COORDS's ped matrix. */
test('the script’s camera, seat, speech and ped-matrix questions are answered',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 // In front of the camera and behind it.
 const seen=await page.evaluate(()=>{
  const g=(window as any).__game,w=g.missionForProfiling().runtime.world,c=g.render().camera;
  const f=c.getWorldDirection(new c.position.constructor());
  const ahead={x:c.position.x+f.x*20,y:-(c.position.z+f.z*20),z:c.position.y+f.y*20},behind={x:c.position.x-f.x*20,y:-(c.position.z-f.z*20),z:c.position.y-f.y*20};
  return {ahead:w.isSphereVisible(ahead,1),behind:w.isSphereVisible(behind,1)};
 });
 expect(seen).toEqual({ahead:true,behind:false});
 const made=await page.evaluate(()=>{
  const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position;
  const car=m.vehicles.create(411,{x:p.x+8,y:-p.z,z:p.y},90),ped=m.peds.create(4,'MALE01',{x:p.x+4,y:-p.z,z:p.y});
  return {car,ped};
 });
 await page.waitForFunction(({car,ped}:{car:number;ped:number})=>{const m=(window as any).__game.missionForProfiling();return !!(m.vehicles.entity(car)&&m.peds.entity(ped));},made,{timeout:45000});
 const matrix=await page.evaluate(({ped}:{ped:number})=>{const m=(window as any).__game.missionForProfiling(),w=m.runtime.world;return {matrix:w.pedMatrix(ped),heading:m.peds.headingOf(ped),player:w.pedMatrix(1)};},made);
 // The forward axis is the heading's (-sin h, cos h), upright.
 const h=matrix.heading*Math.PI/180;
 expect(matrix.matrix.forward.x).toBeCloseTo(-Math.sin(h),5);expect(matrix.matrix.forward.y).toBeCloseTo(Math.cos(h),5);expect(matrix.matrix.up.z).toBe(1);
 expect(Number.isFinite(matrix.player.forward.x)).toBe(true);
 // Not in a car: -1. Warped in as the front passenger: the car's handle.
 const using=()=>page.evaluate(({ped}:{ped:number})=>(window as any).__game.missionForProfiling().runtime.world.pedCarInUse(ped),made);
 expect(await using()).toBe(-1);
 await page.evaluate(({ped,car}:{ped:number;car:number})=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCarAsPassenger(ped,car,0),made);
 expect(await using()).toBe(made.car);
 // A passenger is no driver; the upright car is not upside down; the player's armour rises to its maximum.
 const rest=await page.evaluate(({car}:{car:number})=>{
  const g=(window as any).__game,m=g.missionForProfiling(),w=m.runtime.world;
  w.addArmourToPed(1,-200);const floored=g.state().player.armour;w.addArmourToPed(1,90);w.addArmourToPed(1,25);
  return {driver:w.vehicleDriver(car),upsideDown:w.vehicleIsUpsideDown(car),capped:g.state().player.armour,floored};
 },made);
 expect(rest).toEqual({driver:-1,upsideDown:false,capped:100,floored:0});
 // The siren and visible-damage flags land on the car; the time scale is the one the speed cheats set.
 const flags=await page.evaluate(({car}:{car:number})=>{
  const g=(window as any).__game,m=g.missionForProfiling(),w=m.runtime.world,e=m.vehicles.entity(car);
  w.switchVehicleSiren(car,true);w.setVehicleCanBeVisiblyDamaged(car,false);w.setTimeScale(.5);
  const out={siren:e.siren,visibly:e.canBeVisiblyDamaged,scale:g.state().cheats.timeScale};w.setTimeScale(1);return out;
 },made);
 expect(flags).toEqual({siren:true,visibly:false,scale:.5});
 expect(errors).toEqual([]);
});
