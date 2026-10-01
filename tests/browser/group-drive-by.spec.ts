import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';
const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());
// CTaskAllocatorKillThreatsDriveby: a member of CJ's group riding in his car, not driving it, fires out of the window
// at a ped attacking CJ within 60 units (SWEET3: "Gang members in your car will open fire on threats if you're close
// enough"), and stops once the threat is gone.
test('a homie riding in CJ\'s car shoots at the ped attacking CJ',async({page})=>{
 test.setTimeout(300000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 // On Grove Street's road: CJ at the wheel of a Greenwood, a Grove member in his group beside him.
 const setup=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),a=m.adapterRef;
  a.setPedCoordinates(1,2470,-1660,-100);
  const car=a.createCar(492,2470,-1664,-100),homie=m.peds.create(7,'FAM1',{x:2468,y:-1664,z:-100}),foe=m.peds.create(8,'BALLAS1',{x:2470,y:-1648,z:-100});
  return {car,homie,foe};});
 await page.waitForFunction(s=>{const m=(window as any).__game.missionForProfiling();return !!m.vehicles.entity(s.car)?.car?.body&&!!m.peds.entity(s.homie)&&!!m.peds.entity(s.foe);},setup,{timeout:60000});
 await page.waitForTimeout(1500);
 await page.evaluate(s=>{const g=(window as any).__game,m=g.missionForProfiling(),a=m.adapterRef;
  a.warpPedIntoCar(1,s.car);a.setGroupMember(a.getPlayerGroup(0),s.homie);a.warpPedIntoCarAsPassenger(s.homie,s.car,0);},setup);
 await expect.poll(()=>page.evaluate(s=>{const m=(window as any).__game.missionForProfiling();return m.adapterRef.pedVehicle?.(s.homie)??0;},setup),{timeout:15000}).toBeGreaterThan(0);
 // Nobody threatens yet: the homie rides with his hands in.
 await page.waitForTimeout(1500);
 const rider=()=>page.evaluate(s=>{const e=(window as any).__game.missionForProfiling().peds.entity(s.homie);return {group:e?.groupDriveBy??null,shots:e?.driveBy?.shots??0};},setup);
 expect((await rider()).group).toBeNull();
 // The Balla goes for CJ.
 await page.evaluate(s=>{(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(s.foe,{kind:'killPedOnFoot',target:1,time:-1,flags:0,actionDelay:0,actionChance:0,mustBeOnFoot:true},0x05e2);},setup);
 await expect.poll(async()=>(await rider()).group,{timeout:10000}).not.toBeNull();
 await expect.poll(async()=>(await rider()).shots,{timeout:20000}).toBeGreaterThan(0);
 // A Grove member recruited off the street rides in the back with his pistol: he takes part too.
 await page.evaluate(()=>{const e=(window as any).__game.carEntry();e.passengers.push({modelRef:'FAM2',seat:2,follow:true,gang:1,keep:{weapon:{info:{type:22}}}});});
 const crew=()=>page.evaluate(()=>{const p=(window as any).__game.carEntry().passengers.find((p:any)=>p.seat===2);return {group:p?.groupDriveBy??null,shots:p?.driveBy?.shots??0};});
 await expect.poll(async()=>(await crew()).group,{timeout:10000}).not.toBeNull();
 await expect.poll(async()=>(await crew()).shots,{timeout:20000}).toBeGreaterThan(0);
 // The threat gone, the drive-by ends.
 await page.evaluate(s=>{(window as any).__game.missionForProfiling().adapterRef.deletePed(s.foe);},setup);
 await expect.poll(async()=>(await rider()).group,{timeout:10000}).toBeNull();
 await expect.poll(async()=>(await crew()).group,{timeout:10000}).toBeNull();
 // SWEET4's Ballas go for the car instead (TASK_DESTROY_CAR): that is a threat too.
 const wrecker=await page.evaluate(()=>(window as any).__game.missionForProfiling().peds.create(8,'BALLAS1',{x:2470,y:-1648,z:-100}));
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),wrecker,{timeout:60000});
 await page.waitForTimeout(1500);
 expect((await rider()).group).toBeNull();
 await page.evaluate(({wrecker,car})=>{(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(wrecker,{kind:'destroyCar',vehicle:car},0x0672);},{wrecker,car:setup.car});
 await expect.poll(async()=>(await rider()).group,{timeout:10000}).toBe(`ped:${wrecker}`);
 expect(errors).toEqual([]);
});
