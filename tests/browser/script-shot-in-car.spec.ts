import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

/** CWeapon::CheckForShootingVehicleOccupant (iOS 0x100498190): a bullet whose first hit is a car is handed to the
 * occupant whose head sphere (0.2 about the head node, lifted 0.1) the line passes nearest, one with
 * bCanBeShotInVehicle on. It is a head hit (piece 9): an instant-hit gun kills outright unless the ped is spared
 * critical hits. A script's ped in a car once took no bullets at all (SWEET3's Ballas drove off untouched). */
test('a shot through a script driver\'s head kills him in his seat; one into the door does not touch him',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 const p=await w('pedPosition',1) as {x:number;y:number;z:number};
 // A Voodoo three units off CJ's side, facing north, its driver's side toward him.
 const car=await w('createCar',412,p.x+3.5,p.y,p.z) as number;
 await page.waitForFunction((h:number)=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),car,{timeout:60000});
 await w('setCarHeading',car,0).catch(()=>{});
 const driver=await w('createCharInsideCar',car,25,103,'driver') as number;
 await page.waitForFunction((h:number)=>(window as any).__game.missionForProfiling().peds.entity(h)!==undefined,driver,{timeout:60000});
 await w('givePedWeapon',1,31,500);await w('setPedCurrentWeapon',1,31);
 await page.waitForTimeout(2500);
 const health=()=>w('pedHealth',driver) as Promise<number>;
 // The driver's head sphere where the occupant renderer draws him (renderer axes), and his car's lower door.
 const aims=()=>page.evaluate((h:number)=>{const g=(window as any).__game,e=g.missionForProfiling().vehicles.entity(h);
  const t=g.weapons().seatedPeds().find((s:any)=>s.car===e&&s.seat===0);const c=e.car.body.translation();
  return t?.head?{head:{x:t.head.x,y:t.head.y+.1,z:t.head.z},door:{x:c.x-.9,y:c.y-.3,z:c.z}}:null;},car) as Promise<{head:{x:number;y:number;z:number};door:{x:number;y:number;z:number}}|null>;
 await expect.poll(async()=>!!(await aims()),{timeout:20000}).toBe(true);
 const fire=(at:{x:number;y:number;z:number})=>page.evaluate(a=>(window as any).__game.fireAt(a.x,a.y,a.z),at);
 // Into the door, under the window: the bodywork takes it, the driver does not.
 for(let i=0;i<3;i++){await fire((await aims())!.door);await page.waitForTimeout(400);}
 expect(await health()).toBe(100);
 // Spared critical hits, a head hit is the weapon's damage alone.
 await w('setPedSuffersCriticalHits',driver,false);
 await expect.poll(async()=>{await fire((await aims())!.head);await page.waitForTimeout(250);return health();},{timeout:20000,intervals:[0]}).toBeLessThan(100);
 expect(await w('pedIsDeadForScript',driver)).toBe(false);
 // Suffering them again, the next one in the head kills him where he sits.
 await w('setPedSuffersCriticalHits',driver,true);
 await expect.poll(async()=>{await fire((await aims())!.head);await page.waitForTimeout(250);return w('pedIsDeadForScript',driver);},{timeout:20000,intervals:[0]}).toBe(true);
 expect(await page.evaluate(h=>{const e=(window as any).__game.missionForProfiling().peds.entity(h);return {seat:e?.seat,inSeat:!!e?.diedInSeat};},driver)).toEqual({seat:'driver',inSeat:true});
 expect(errors).toEqual([]);
});
