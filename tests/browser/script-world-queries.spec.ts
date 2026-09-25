import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** GET_CHAR_IN_CAR_PASSENGER_SEAT (MAIN, LOWR, SWEET6), IS_LINE_OF_SIGHT_CLEAR (BCRASH1, HEIST5), DOES_GROUP_EXIST
 * (RYDER2), SET_CAR_ENGINE_ON (GARAG1, SYN1), IS_CHAR_ATTACHED_TO_ANY_CAR (LOWR, SWEET6), HAS_LANGUAGE_CHANGED,
 * GET_WATER_HEIGHT_AT_COORDS (SMOKE2, DRIV2), SET_CAR_MISSION (HOODS5, CASINO4), CAR_WANDER_RANDOMLY (STEAL2, CASINO4)
 * and SET_CAR_CAN_GO_AGAINST_TRAFFIC (HOODS5, HEIST2). */
test('a script reads a passenger seat, a line of sight, a group, a car engine, car axes and speed, and an accurate drive',async({page})=>{
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
 // SET_CAR_MISSION sets the autopilot's mission straight: MISSION_STOP_FOREVER, then none.
 const mission=()=>page.evaluate(car=>{const g=(window as any).__game;return g.scriptCars().mission(g.missionForProfiling().vehicles.entity(car))??'none';},made.car);
 await w('setVehicleMission',made.car,11);
 expect(await mission()).toBe('stopForever');
 await w('setVehicleMission',made.car,0);
 expect(await mission()).toBe('none');
 // CAR_WANDER_RANDOMLY puts it on MISSION_CRUISE at a cruise speed of at least 1; the traffic switch is kept.
 await w('setVehicleCruiseSpeed',made.car,0);await w('vehicleWanderRandomly',made.car);
 expect(await mission()).toBe('cruise');
 await w('setVehicleCanGoAgainstTraffic',made.car,false);
 expect(await page.evaluate(car=>(window as any).__game.missionForProfiling().vehicles.entity(car).autopilotFields,made.car)).toMatchObject({cruiseSpeed:1,cantGoAgainstTraffic:1});
 await w('setVehicleMission',made.car,0);
 // A ped held on the car by ATTACH_CHAR_TO_CAR is attached to it; one in a seat is not.
 const rider=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().peds.create(4,'MALE01',{x:p.x+4,y:-p.z-3,z:p.y});});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),rider,{timeout:60000});
 await w('attachPedToCar',rider,made.car,{x:0,y:-1,z:1});
 expect(await w('isCharAttachedToAnyCar',rider)).toBe(true);
 expect(await w('isCharAttachedToAnyCar',made.ped)).toBe(false);
 expect(await w('hasLanguageChanged')).toBe(false);
 // The lake at 40.6 north of the desert, without the swell; dry land writes nothing, read as 0.
 expect(await w('waterHeightAtCoords',-1170,2680,false)).toBeCloseTo(40.6,3);
 expect(await w('waterHeightAtCoords',2495,-1680,false)).toBe(0);
 expect(errors).toEqual([]);
});
