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
 // Within the one frame: CPedGroups::Process removes a group still empty on the next, as the original does.
 const group=await page.evaluate(()=>{const w=(window as any).__game.missionForProfiling().runtime.world,g=w.createGroup(),made=w.groupExists(g);w.removeGroup(g);return {made,removed:!w.groupExists(g)};});
 expect(group).toEqual({made:true,removed:true});
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
 // GET_DEAD_CHAR_COORDINATES: the car a seated ped is in; a ped only held on the car by its pelvis, near its root.
 const seatedAt=await w('deadPedCoordinates',made.ped),carAt=await w('vehiclePosition',made.car);
 expect(Math.hypot(seatedAt.x-carAt.x,seatedAt.y-carAt.y,seatedAt.z-carAt.z)).toBeLessThan(.01);
 const pelvis=await w('deadPedCoordinates',rider),root=await w('pedPosition',rider);
 expect(Math.hypot(pelvis.x-root.x,pelvis.y-root.y)).toBeLessThan(1);expect(Math.abs(pelvis.z-root.z)).toBeLessThan(1.2);
 expect(await w('hasLanguageChanged')).toBe(false);
 // DRAW_CROSSHAIR: the aiming circle shows without aiming while it is on, and goes with it.
 const crosshair=()=>page.evaluate(()=>{const e=document.querySelector('.weapon-crosshair') as HTMLElement|null;return !!e&&!e.hidden;});
 await w('drawCrosshair',true);await expect.poll(crosshair,{timeout:5000}).toBe(true);
 await w('drawCrosshair',false);await expect.poll(crosshair,{timeout:5000}).toBe(false);
 // DRAW_CORONA: registered under the thread's id with the script's colour and size and 450 units of range, and gone
 // once the script stops asking for it each frame.
 const me=await w('pedPosition',1);
 const ask=()=>w('drawCorona',me.x+3,me.y,me.z+1,.5,0,0,255,10,20,4242);
 const slot=()=>page.evaluate(()=>(window as any).__game.coronaSlots().find((c:any)=>c.id===4242)??null);
 await expect.poll(async()=>{await ask();return slot();},{timeout:10000}).toMatchObject({color:[255,10,20],alpha:255,size:.5,farClip:450});
 await expect.poll(slot,{timeout:10000}).toBeNull();
 // GET_VEHICLE_CLASS: vehicles.ide's class, the police car's 'ignore' as -1.
 expect(await w('getVehicleClass',made.car)).toBe(-1);
 // IS_CAR_DEAD: whole, the car lives; blown up (STATUS_WRECKED), it is dead though it is still there.
 expect(await w('vehicleIsDeadForScript',made.car)).toBe(false);
 // IS_CHAR_GETTING_IN_TO_A_CAR: a ped sent to the car is getting in until it sits; the idle player is not.
 expect(await w('pedIsGettingIntoCar',1)).toBe(false);
 const walker=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().peds.create(4,'MALE01',{x:p.x+2,y:-p.z+6,z:p.y});});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),walker,{timeout:60000});
 expect(await w('pedIsGettingIntoCar',walker)).toBe(false);
 await w('givePedScriptedTask',walker,{kind:'enterCarAsPassenger',vehicle:made.car,time:20000,seat:1,moveState:4},0x05ca);
 await expect.poll(()=>w('pedIsGettingIntoCar',walker),{timeout:10000}).toBe(true);
 // The lake at 40.6 north of the desert, without the swell; dry land writes nothing, read as 0.
 expect(await w('waterHeightAtCoords',-1170,2680,false)).toBeCloseTo(40.6,3);
 expect(await w('waterHeightAtCoords',2495,-1680,false)).toBe(0);
 await w('explodeVehicle',made.car);
 await expect.poll(()=>w('vehicleIsDeadForScript',made.car),{timeout:10000}).toBe(true);
 expect(await w('vehicleExists',made.car)).toBe(true);
 expect(errors).toEqual([]);
});
