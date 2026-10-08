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
 // TASK_PLAY_ANIM does not take the rider off: INTRO1's homies wave BMX_COMEON (MISC) from their saddles and ride on.
 const gaveUp=()=>page.evaluate(()=>(window as any).__game.missionForProfiling().snapshot().gaveUp.length);
 const before=await gaveUp();
 const PLAY=0x0605;
 await page.evaluate(({ped})=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(ped,{kind:'playAnim',animationName:'BMX_COMEON',animationFile:'MISC',blendSpeed:4,loop:false,lockX:false,lockY:false,keepLastFrame:false,time:-1,interruptable:true},0x0605),made);
 const seated=()=>page.evaluate(({ped,bike})=>(window as any).__game.missionForProfiling().runtime.world.pedVehicle(ped)===bike,made);
 const drawn=()=>page.evaluate(bike=>{const g=(window as any).__game,b=g.missionForProfiling().vehicles.entity(bike);return g.occupants().views.get(`script:${b.car.body.handle}:driver`)?.view.snapshot().vehicleClip??null;},made.bike);
 await expect.poll(drawn,{timeout:30000}).toBe('bmx_comeon');
 expect(await seated()).toBe(true);
 // The clip ends and the task with it, the rider still on the saddle and back in its riding pose.
 await expect.poll(()=>page.evaluate(({ped})=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(ped,0x0605),{ped:made.ped}),{timeout:30000}).toBe(7);
 expect(await seated()).toBe(true);
 await expect.poll(drawn,{timeout:10000}).not.toBe('bmx_comeon');
 // A walking task does take him off, at the bike's left, where a car's door frames used to be read off the bike.
 const at=await page.evaluate(({bike})=>(window as any).__game.missionForProfiling().runtime.world.vehiclePosition(bike),made);
 await page.evaluate(({ped,at})=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(ped,{kind:'goStraightToCoord',x:at.x+4,y:at.y+4,z:at.z,speed:4,time:-1},0x05d3),{...made,at});
 await expect.poll(seated,{timeout:30000}).toBe(false);
 expect(await gaveUp()).toBe(before);
 expect(faults).toEqual([]);expect(errors).toEqual([]);
});

/** TASK_ENTER_CAR_AS_DRIVER on the player and a bike: TWAR7 sends CJ to a PCJ-600 behind the Ballas' house and waits
 * for him on it. The player's enter task knew only cars, ended at once on the bike, and the mission waited for good. */
test('a script sends the player to a bike and he gets on it',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const bike=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position;return m.vehicles.create(461,{x:p.x+6,y:-p.z+2,z:-100},90);});
 await page.waitForFunction(b=>!!(window as any).__game.missionForProfiling().vehicles.entity(b),bike,{timeout:60000});
 await page.waitForTimeout(1000);
 await page.evaluate(b=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(1,{kind:'enterCarAsDriver',vehicle:b,time:-1},0x05cb),bike);
 await expect.poll(()=>page.evaluate(b=>(window as any).__game.missionForProfiling().runtime.world.pedVehicle(1)===b,bike),{timeout:30000}).toBe(true);
 // The task is over once he is on (GET_SCRIPT_TASK_STATUS reads finished).
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(1,0x05cb)),{timeout:10000}).toBe(7);
 expect(errors).toEqual([]);
});

/** The pillion (pPassengers[0] of a bike) sits at the model's ped_backseat holding the ride group's BIKE_PASSENGER.
 * TWAR7's OG Loc rode CJ's PCJ-600 unseen: the occupant drawing skipped every bike rider but the driver. */
test('a script ped on the back of a bike is drawn there, in the passenger clip',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const made=await page.evaluate(()=>{
  const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position;
  return {bike:m.vehicles.create(461,{x:p.x+6,y:-p.z,z:-100},90),ped:m.peds.create(4,'MALE01',{x:p.x+4,y:-p.z+3,z:p.y})};
 });
 await page.waitForFunction(({bike,ped})=>{const m=(window as any).__game.missionForProfiling();return !!m.vehicles.entity(bike)&&!!m.peds.entity(ped);},made,{timeout:60000});
 await page.evaluate(({ped,bike})=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCarAsPassenger(ped,bike,0),made);
 const drawn=()=>page.evaluate(bike=>{const g=(window as any).__game,b=g.missionForProfiling().vehicles.entity(bike),v=g.occupants().views.get(`script:${b.car.body.handle}:pillion`);
  if(!v)return null;const seat=b.backSeat(),root=v.view.root.position,at=b.car.root.localToWorld(root.clone().set(seat.x,seat.z,-seat.y));
  return {clip:v.view.snapshot().vehicleClip,visible:v.view.root.visible,off:Math.hypot(root.x-at.x,root.y-at.y,root.z-at.z)};},made.bike);
 await expect.poll(async()=>(await drawn())?.clip??null,{timeout:30000}).toBe('bikes_passenger');
 const pose=await drawn();expect(pose!.visible).toBe(true);expect(pose!.off).toBeLessThan(.05);
 expect(errors).toEqual([]);
});
