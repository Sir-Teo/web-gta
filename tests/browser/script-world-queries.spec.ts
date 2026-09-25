import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** GET_CHAR_IN_CAR_PASSENGER_SEAT (MAIN, LOWR, SWEET6), IS_LINE_OF_SIGHT_CLEAR (BCRASH1, HEIST5), DOES_GROUP_EXIST
 * (RYDER2) and SET_CAR_ENGINE_ON (GARAG1, SYN1). */
test('a script reads a passenger seat, a line of sight, a group, a car engine, a car'\''s axes and speed, and drives it accurately',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const made=await page.evaluate(()=>{
  const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position;
  return {car:m.vehicles.create(596,{x:p.x+8,y:-p.z,z:-100},0),ped:m.peds.create(4,'MALE01',{x:p.x+4,y:-p.z+3,z:p.y})};
 });
 await page.waitForFunction(({car,ped})=>{const m=(window as any).__game.missionForProfiling();return !!m.vehicles.entity(car)&&!!m.peds.entity(ped);},made,{timeout:60000});
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 await w('warpPedIntoCarAsPassenger',made.ped,made.car,0);
 expect(await w('pedInPassengerSeat',made.car,0)).toBe(made.ped);
 expect(await w('pedInPassengerSeat',made.car,1)).toBe(-1);
 // From beside the player through the car: the car blocks a sight over vehicles, not one over buildings alone.
 const ends=await page.evaluate(car=>{const g=(window as any).__game,m=g.missionForProfiling(),c=m.runtime.world.vehiclePosition(car);return {from:{x:c.x-6,y:c.y,z:c.z},to:{x:c.x+6,y:c.y,z:c.z}};},made.car);
 const flags=(vehicles:boolean)=>({buildings:true,vehicles,peds:false,objects:false,particles:false});
 expect(await w('lineOfSightIsClear',ends.from,ends.to,flags(true))).toBe(false);
 expect(await w('lineOfSightIsClear',ends.from,ends.to,flags(false))).toBe(true);
 const group=await w('createGroup');
 expect(await w('groupExists',group)).toBe(true);
 await w('removeGroup',group);
 expect(await w('groupExists',group)).toBe(false);
 await w('setVehicleEngineOn',made.car,true);
 expect(await page.evaluate(car=>(window as any).__game.missionForProfiling().vehicles.entity(car).engineRunning,made.car)).toBe(true);
 // A car standing level facing north (heading 0): forward (0, 1), no pitch or roll, and no speed.
 const pose=await page.evaluate(car=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.setVehicleHeading(car,0);
  return {fx:w.vehicleForwardX(car),fy:w.vehicleForwardY(car),pitch:w.getCarPitch(car),roll:w.vehicleRoll(car),v:w.getCarSpeedVector(car)};},made.car);
 expect(Math.abs(pose.fx)).toBeLessThan(.05);expect(pose.fy).toBeGreaterThan(.99);
 expect(Math.abs(pose.pitch)).toBeLessThan(5);expect(Math.abs(pose.roll)).toBeLessThan(5);
 expect(Math.hypot(pose.v.x,pose.v.y,pose.v.z)).toBeLessThan(1);
 // CAR_GOTO_COORDINATES_ACCURATE puts the car on the accurate go-to mission.
 await w('vehicleGotoCoordinatesAccurate',made.car,ends.to.x+40,ends.to.y,ends.to.z);
 expect(await page.evaluate(car=>{const g=(window as any).__game;return g.scriptCars().mission(g.missionForProfiling().vehicles.entity(car));},made.car)).toMatch(/^gotoCoords.*Accurate$/);
 expect(errors).toEqual([]);
});
