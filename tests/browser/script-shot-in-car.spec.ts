import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

/** CWeapon::CheckForShootingVehicleOccupant (iOS 0x100498190): a bullet that reaches a car reaches the ped seated in it,
 * one whose bCanBeShotInVehicle is on (as every ped's is). SWEET3's Ballas fled in their Voodoo untouched by Sweet and
 * Smoke's drive-by, reached Grove Street and failed the mission: a script's ped in a car took no bullets at all. */
test('a script drive-by kills the script ped seated in the car it fires at, who dies in his seat',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 // Sweet's Greenwood and the Ballas' Voodoo side by side, both facing north, the Voodoo on the Greenwood's right.
 const [greenwood,voodoo]=await page.evaluate(()=>{const w=(window as any).__game.missionForProfiling().runtime.world,p=w.pedPosition(1);
  const a=w.createCar(492,p.x+12,p.y+4,p.z),b=w.createCar(412,p.x+18,p.y+4,p.z);w.setCarHeading?.(a,0);w.setCarHeading?.(b,0);return [a,b];});
 await page.waitForFunction(([a,b])=>{const m=(window as any).__game.missionForProfiling();return !!m.vehicles.entity(a)&&!!m.vehicles.entity(b);},[greenwood,voodoo],{timeout:60000});
 const [ballas,homie]=await page.evaluate(([a,b])=>{const w=(window as any).__game.missionForProfiling().runtime.world;
  return [w.createCharInsideCar(b,25,103,'driver'),w.createCharInsideCar(a,24,106,0)];},[greenwood,voodoo]);
 await page.waitForFunction(([x,y])=>{const m=(window as any).__game.missionForProfiling();return m.peds.entity(x)!==undefined&&m.peds.entity(y)!==undefined;},[ballas,homie],{timeout:60000});
 const health=()=>page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.pedHealth(h),ballas);
 expect(await health()).toBe(100);
 // Smoke's TASK_DRIVE_BY: out of the right-hand window at the Voodoo, every burst taken.
 await page.evaluate(([h,v])=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(h,{kind:'driveBy',targetPed:-1,targetVehicle:v,x:0,y:0,z:0,radius:5000,type:8,rightHandCarSeat:true,fireRate:100},0x0713),[homie,voodoo]);
 await expect.poll(health,{timeout:30000,intervals:[500]}).toBeLessThan(100);
 await expect.poll(()=>page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.pedIsDeadForScript(h),ballas),{timeout:60000,intervals:[500]}).toBe(true);
 // Dead where he sat: the rider stays in the seat, slumped, rather than vanishing.
 expect(await page.evaluate(h=>{const e=(window as any).__game.missionForProfiling().peds.entity(h);return {seat:e?.seat,inSeat:!!e?.diedInSeat};},ballas)).toEqual({seat:'driver',inSeat:true});
 expect(errors).toEqual([]);
});
