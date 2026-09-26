import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** SET_VEHICLE_AIR_RESISTANCE_MULTIPLIER (HOODS5, DESERT9) scales a car's handling drag; IS_THIS_MODEL_A_CAR, _BOAT,
 * _HELI and _PLANE read the model's vehicles.ide type; SET_CAR_STAY_IN_SLOW_LANE (STEAL2, TORENO2) sets the
 * autopilot's flag; IS_GERMAN_GAME is false; SET_CHAR_VELOCITY (DESERT9, HEIST9) throws the player. */
test('a script scales a car\'s drag, reads model types, keeps a car in the slow lane and throws the player',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 // Model types: a Glendale is a car, a Speeder a boat, a Maverick a heli, a Dodo a plane; a monster truck is no car.
 await expect.poll(()=>w('isThisModelACar',466).catch(()=>'pending'),{timeout:60000}).toBe(true);
 expect([await w('modelIsBoat',452),await w('modelIsHeli',487),await w('modelIsPlane',593)]).toEqual([true,true,true]);
 expect([await w('isThisModelACar',444),await w('modelIsBoat',466),await w('modelIsHeli',593),await w('modelIsPlane',487),await w('isThisModelACar',1337)]).toEqual([false,false,false,false,false]);
 expect(await w('gameIsGerman')).toBe(false);
 // Two cars made on the airport's runway the moment the player is put there, before its collision is in:
 // CreateCarForScript sets them at FindGroundZForCoord's 20 waiting for collision (static), and they are set down
 // on the runway (12.55) when it arrives.
 const cars=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling();m.runtime.world.setPedCoordinates(1,1530,-2503,13.6);
  return [m.vehicles.create(596,{x:1510,y:-2493,z:-100},90),m.vehicles.create(596,{x:1510,y:-2513,z:-100},90)];});
 await page.waitForFunction(h=>h.every((c:number)=>!!(window as any).__game.missionForProfiling().vehicles.entity(c)),cars,{timeout:60000});
 await page.waitForFunction(()=>{const st=(window as any).__game.state();return !st.terrainHold&&st.player.grounded;},undefined,{timeout:120000});
 await expect.poll(async()=>[await w('vehicleIsWaitingForWorldCollision',cars[0]),await w('vehicleIsWaitingForWorldCollision',cars[1])],{timeout:20000}).toEqual([false,false]);
 await page.waitForTimeout(1500);
 for(const c of cars){const at=await w('vehiclePosition',c);expect(at.z).toBeGreaterThan(12.5);expect(at.z).toBeLessThan(14.5);}
 expect(await page.evaluate(()=>(window as any).__game.state().player.position.y)).toBeGreaterThan(12);
 await w('setVehicleAirResistanceMultiplier',cars[0],.1);await w('setVehicleAirResistanceMultiplier',cars[1],5);
 expect(await page.evaluate(h=>h.map((c:number)=>(window as any).__game.missionForProfiling().vehicles.entity(c).airResistanceMultiplier),cars)).toEqual([Math.fround(.1),5]);
 for(const c of cars)await w('setVehicleForwardSpeed',c,30);
 await page.waitForTimeout(1500);
 const [light,heavy]=[await w('vehicleSpeed',cars[0]),await w('vehicleSpeed',cars[1])];
 expect(heavy).toBeLessThan(light);
 // The slow-lane flag goes to the autopilot.
 await w('setVehicleStayInSlowLane',cars[0],true);
 expect(await page.evaluate(c=>(window as any).__game.missionForProfiling().vehicles.entity(c).autopilotFields.stayInSlowLane,cars[0])).toBe(1);
 // Thrown up at 10 a second the player leaves the ground and rises.
 const y0=await page.evaluate(()=>(window as any).__game.state().player.position.y);
 await w('setPedVelocity',1,{x:0,y:0,z:.2});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().player.position.y),{timeout:5000}).toBeGreaterThan(y0+1);
 // A script ped's velocity is a reported gap.
 const ped=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().peds.create(4,'MALE01',{x:p.x+4,y:-p.z-3,z:p.y});});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),ped,{timeout:60000});
 expect(await page.evaluate(ped=>{try{(window as any).__game.missionForProfiling().runtime.world.setPedVelocity(ped,{x:0,y:0,z:1});return 'taken';}catch(e){return String(e).includes('SET_CHAR_VELOCITY')?'gap':String(e);}},ped)).toBe('gap');
 expect(errors).toEqual([]);
});
