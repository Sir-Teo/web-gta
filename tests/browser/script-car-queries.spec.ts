import {test,expect} from '@playwright/test';
/** CREATE_CAR faces the car along the script's heading. TURN_CAR_TO_FACE_COORD turns a car where it stands; GET_MAXIMUM_NUMBER_OF_PASSENGERS counts the model's door
 * frames less one (a Landstalker has four); GET_NUMBER_OF_PASSENGERS counts who sits in the passenger seats. */
test('a script car turns to face a point and reports its seats',async({page})=>{
 test.setTimeout(240000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().vehicles.create(400,{x:p.x+8,y:-p.z,z:p.y},90);});
 await page.waitForFunction(car=>!!(window as any).__game.missionForProfiling().vehicles.entity(car),car,{timeout:45000});
 const w=(fn:string,...args:number[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 // CREATE_CAR's heading of 90 faces the car west: its front, the body's -z, along native -x.
 const front=await page.evaluate(car=>{const q=(window as any).__game.missionForProfiling().vehicles.entity(car).car.body.rotation();return {x:-2*(q.x*q.z+q.w*q.y),y:1-2*(q.x*q.x+q.y*q.y)};},car);
 expect(front.x).toBeLessThan(-.95);
 expect(await w('vehicleHeading',car)).toBeCloseTo(90,-1);
 const before=await w('vehiclePosition',car);
 // A point due north (script +y) is a heading of nothing; due east is 270.
 await w('turnVehicleToFaceCoord',car,before.x,before.y+20);
 const north=await w('vehicleHeading',car);expect(Math.min(north,360-north)).toBeLessThan(.5);
 await w('turnVehicleToFaceCoord',car,before.x+20,before.y);
 expect(await w('vehicleHeading',car)).toBeCloseTo(270,0);
 const after=await w('vehiclePosition',car);
 expect(Math.hypot(after.x-before.x,after.y-before.y)).toBeLessThan(.5);
 expect(await w('vehicleMaximumPassengers',car)).toBe(3);
 expect(await w('vehiclePassengerCount',car)).toBe(0);
 const rider=await page.evaluate(car=>(window as any).__game.missionForProfiling().peds.createInCar(4,'male01',car,0),car);
 await page.waitForFunction(rider=>!!(window as any).__game.missionForProfiling().peds.entity(rider),rider,{timeout:45000});
 expect(await w('vehiclePassengerCount',car)).toBe(1);
 // BURST_CAR_TYRE 0: the front left tyre (eCarWheel 0).
 await w('burstVehicleTyre',car,0);
 expect(await page.evaluate(car=>(window as any).__game.missionForProfiling().vehicles.entity(car).damageState.wheels[0],car)).toBe(1);
 expect(errors).toEqual([]);
});
