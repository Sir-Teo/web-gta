import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** INTRO1's homies get on their BMXs by TASK_ENTER_CAR_AS_DRIVER and ride them by TASK_CAR_DRIVE_TO_COORD. Resolving
 * a bike for a ped's enter task used to read a car's frames off it and threw every frame, which stopped every street
 * and script ped; and the driving tasks did nothing on a bike. */
test('a script ped gets on a script BMX and rides it to a point, and the peds keep stepping',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[],faults:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&m.text().includes('Subsystem fault'))faults.push(m.text());});
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const made=await page.evaluate(()=>{
  const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position;
  return {bike:m.vehicles.create(481,{x:p.x+8,y:-p.z,z:-100},90),ped:m.peds.create(4,'MALE01',{x:p.x+6,y:-p.z+3,z:p.y})};
 });
 await page.waitForFunction(({bike,ped})=>{const m=(window as any).__game.missionForProfiling();return !!m.vehicles.entity(bike)&&!!m.peds.entity(ped);},made,{timeout:60000});
 await page.evaluate(({ped,bike})=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(ped,{kind:'enterCarAsDriver',vehicle:bike,time:-1},0x05cb),made);
 await expect.poll(()=>page.evaluate(({ped,bike})=>(window as any).__game.missionForProfiling().runtime.world.pedVehicle(ped)===bike,made),{timeout:60000}).toBe(true);
 // CAutoPilot takes the rider's pedals: TASK_CAR_DRIVE_TO_COORD to a point 60 units off, at cruise speed 10, rides
 // the bike away along the roads.
 const start=await page.evaluate(bike=>(window as any).__game.missionForProfiling().runtime.world.vehiclePosition(bike),made.bike);
 await page.evaluate(({ped,bike,start})=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(ped,{kind:'carDriveToCoord',vehicle:bike,x:start.x+60,y:start.y,z:start.z,speed:10,driveStyle:0,model:-1,drivingStyle:2},0x05d1),{...made,start});
 const moved=()=>page.evaluate(({bike,start})=>{const p=(window as any).__game.missionForProfiling().runtime.world.vehiclePosition(bike);return Math.hypot(p.x-start.x,p.y-start.y);},{...made,start});
 await expect.poll(moved,{timeout:60000}).toBeGreaterThan(10);
 // A drive task naming no car (-1) drives the one the ped is on (CTaskComplexCarDrive::CreateFirstSubTask).
 await page.evaluate(({ped,start})=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(ped,{kind:'carDriveToCoord',vehicle:-1,x:start.x-60,y:start.y,z:start.z,speed:10,driveStyle:0,model:-1,drivingStyle:2},0x05d1),{...made,start});
 expect(await page.evaluate(({bike,start})=>{const g=(window as any).__game,b=g.missionForProfiling().vehicles.entity(bike),m=g.scriptCars().missions.get(b);return m&&Math.round(m.goal.x-start.x);},{...made,start})).toBe(-60);
 // The rider is drawn on the saddle with the BMX group's clip.
 await expect.poll(()=>page.evaluate(bike=>{const g=(window as any).__game,b=g.missionForProfiling().vehicles.entity(bike);return [...g.occupants().views.keys()].includes(`script:${b.car.body.handle}:driver`);},made.bike),{timeout:30000}).toBe(true);
 // An on-foot task takes the rider off first (INTRO1 plays a clip on each homie at the end of the ride): he steps
 // off at the bike's left, where a car's door frames used to be read off the bike and stop the script.
 const gaveUp=()=>page.evaluate(()=>(window as any).__game.missionForProfiling().snapshot().gaveUp.length);
 const before=await gaveUp();
 await page.evaluate(({ped})=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(ped,{kind:'playAnim',animationName:'IDLE_chat',animationFile:'PED',blendSpeed:4,loop:false,lockX:false,lockY:false,keepLastFrame:false,time:-1,interruptable:true},0x0605),made);
 await expect.poll(()=>page.evaluate(({ped})=>(window as any).__game.missionForProfiling().runtime.world.pedVehicle(ped)??null,made),{timeout:30000}).toBeNull();
 const off=await page.evaluate(({ped,bike})=>{const w=(window as any).__game.missionForProfiling().runtime.world,a=w.pedPosition(ped),b=w.vehiclePosition(bike);return Math.hypot(a.x-b.x,a.y-b.y);},made);
 expect(off).toBeLessThan(3);
 expect(await gaveUp()).toBe(before);
 expect(faults).toEqual([]);expect(errors).toEqual([]);
});
