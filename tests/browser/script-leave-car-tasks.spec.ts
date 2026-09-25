import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** TASK_EVERYONE_LEAVE_CAR (RYDER3, LA1FIN2, WUZI1), TASK_LEAVE_CAR_AND_FLEE (MUSIC3, BCRASH1, STEAL1) and
 * TASK_GOTO_CAR (CAT1, SYN2, STEAL4). */
test('everyone leaves a car, a rider leaves and flees a point, and a ped goes to a car',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().vehicles.create(596,{x:p.x+10,y:-p.z,z:-100},0);});
 await page.waitForFunction(c=>!!(window as any).__game.missionForProfiling().vehicles.entity(c),car,{timeout:60000});
 const driver=await page.evaluate(c=>(window as any).__game.missionForProfiling().peds.createInCar(7,'MALE01',c,'driver'),car);
 const passenger=await page.evaluate(c=>(window as any).__game.missionForProfiling().peds.createInCar(7,'MALE01',c,0),car);
 await page.waitForFunction(([a,b])=>{const m=(window as any).__game.missionForProfiling();return !!m.peds.entity(a)&&!!m.peds.entity(b);},[driver,passenger],{timeout:60000});
 expect(await w('pedVehicle',driver)).toBe(car);expect(await w('pedVehicle',passenger)).toBe(car);
 await w('givePedScriptedTask',-1,{kind:'everyoneLeaveCar',vehicle:car},0x0822);
 await expect.poll(async()=>[await w('pedVehicle',driver),await w('pedVehicle',passenger)],{timeout:30000}).toEqual([undefined,undefined]);
 // Back in, then out and away from a point beside the car: 60 units of safe distance.
 // A ped still being built on foot holds the command a frame, as the runtime would.
 await expect.poll(async()=>{try{await w('warpPedIntoCar',driver,car);return true;}catch{return false;}},{timeout:30000}).toBe(true);
 await expect.poll(()=>w('pedVehicle',driver),{timeout:30000}).toBe(car);
 const at=await w('vehiclePosition',car) as {x:number;y:number;z:number};
 await w('givePedScriptedTask',driver,{kind:'leaveCarAndFlee',vehicle:car,x:at.x+2,y:at.y,z:at.z},0x0622);
 await expect.poll(()=>w('pedVehicle',driver),{timeout:30000}).toBeUndefined();
 const away=async()=>{const p=await w('pedPosition',driver) as {x:number;y:number};return Math.hypot(p.x-at.x-2,p.y-at.y);};
 await expect.poll(away,{timeout:60000}).toBeGreaterThan(12);
 // The passenger goes to the car and stops inside the radius.
 await w('givePedScriptedTask',passenger,{kind:'gotoCar',vehicle:car,time:-1,radius:3},0x0799);
 await expect.poll(async()=>{const p=await w('pedPosition',passenger) as {x:number;y:number};return Math.hypot(p.x-at.x,p.y-at.y);},{timeout:60000}).toBeLessThan(4.5);
 expect(errors).toEqual([]);
});
