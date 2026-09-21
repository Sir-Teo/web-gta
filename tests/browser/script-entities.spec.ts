import {test,expect} from '@playwright/test';
/** CREATE_CAR and CREATE_CHAR hand the script a handle inside the command. The browser has to stream a model
 * before it can build either, so the pools hold the handle across that gap. This drives the pools the way the
 * script drives them — a handle used on the instruction after the one that made it — and checks that what the
 * script said before the entity arrived is what the world ends up doing. */
test('the script’s own peds and cars arrive, obey and go',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);

 // Make both beside the player, and use the handles at once, as the script does.
 const made=await page.evaluate(()=>{
  const game=(window as any).__game,mission=game.missionForProfiling();
  const p=game.state().player.position,at={x:p.x+6,y:-p.z,z:p.y};
  // The pools speak the script's coordinates: x east, y north, z up.
  const car=mission.vehicles.create(411,{x:at.x,y:at.y,z:at.z},90);
  const ped=mission.peds.create(4,'MALE01',{x:at.x+3,y:at.y,z:at.z});
  return {car,ped,carHere:mission.vehicles.exists(car),pedHere:mission.peds.exists(ped),
   carAt:mission.vehicles.positionOf(car),pedAt:mission.peds.positionOf(ped),
   pedHealth:mission.peds.healthOf(ped),pedMale:mission.peds.isMale(ped)};
 });
 // The handles come back at once, above the player's own, and answer from the script's own word.
 expect(made.car).toBeGreaterThan(1000);expect(made.ped).toBeGreaterThan(1000);
 expect(made.carHere).toBe(true);expect(made.pedHere).toBe(true);
 expect(made.pedHealth).toBe(100);expect(made.pedMale).toBe(true);

 // Both are built once their models are streamed; a failed spawn would make the handle stop existing.
 const built=await page.evaluate(async({car,ped}:{car:number;ped:number})=>{
  const mission=(window as any).__game.missionForProfiling();
  const deadline=Date.now()+45000;
  while(Date.now()<deadline&&!(mission.vehicles.entity(car)&&mission.peds.entity(ped)))await new Promise(r=>setTimeout(r,250));
  return {car:!!mission.vehicles.entity(car),ped:!!mission.peds.entity(ped),
   carExists:mission.vehicles.exists(car),pedExists:mission.peds.exists(ped),
   carSettled:mission.vehicles.settledFor(car),pedSettled:mission.peds.settledFor(ped)};
 },{car:made.car,ped:made.ped});
 expect(built.car).toBe(true);expect(built.ped).toBe(true);
 expect(built.carExists).toBe(true);expect(built.pedExists).toBe(true);

 // The two orders that take time, through the translation that produces them. CTaskSimpleStandStill holds the
 // ped where it is until its own time runs out, and CTaskSimpleAchieveHeading turns it to face north and ends
 // inside the task's own tolerance. A scripted task replaces whatever the ped was busy with, so neither the
 // wander nor an attractor turns it away while it obeys.
 const ordered=await page.evaluate(async({ped}:{ped:number})=>{
  const game=(window as any).__game,mission=game.missionForProfiling(),browserPed=mission.peds.entity(ped);
  const peds=game.pedestrians();
  mission.peds.setHealth(ped,250);
  // A script heading of nothing is the browser's yaw of half a turn; watch how near the ped gets to it while
  // the order lasts, because the wander it returns to afterwards starts turning it away at once.
  const offNorth=()=>Math.abs(Math.atan2(Math.sin(browserPed.actor.player.heading-Math.PI),Math.cos(browserPed.actor.player.heading-Math.PI)));
  let nearest=Number.POSITIVE_INFINITY;
  const wait=async()=>{
   const deadline=Date.now()+15000;
   while(Date.now()<deadline&&browserPed.order){nearest=Math.min(nearest,offNorth());await new Promise(r=>setTimeout(r,16));}
  };
  peds.giveOrder(browserPed,{kind:'standStill',seconds:1.5});
  const stood=browserPed.order?.kind??null,at={...browserPed.actor.player.position};
  await wait();
  const moved=Math.hypot(browserPed.actor.player.position.x-at.x,browserPed.actor.player.position.z-at.z);
  peds.giveOrder(browserPed,{kind:'achieveHeading',degrees:0});
  const turning=browserPed.order?.kind??null;
  nearest=Number.POSITIVE_INFINITY;
  await wait();
  // The order ends on the frame the ped reaches the heading, and the wander it returns to starts turning it
  // away on the next one, so the reading that matters is the one taken as the order clears.
  nearest=Math.min(nearest,offNorth());
  return {health:mission.peds.healthOf(ped),stood,moved,turning,finished:!browserPed.order,heading:nearest};
 },{ped:made.ped});
 expect(ordered.health).toBe(250);
 expect(ordered.stood).toBe('standStill');
 // The ped stands where it was told to. Crowd separation still parts overlapping bodies, so this says it did
 // not walk off rather than that it did not shift at all.
 expect(ordered.moved).toBeLessThan(2);
 expect(ordered.turning).toBe('achieveHeading');
 expect(ordered.finished).toBe(true);
 // The task ends on the frame the ped reaches the heading, and CPed::UpdateHeading turns it toward its next
 // wander point on the very next one — at the full rate, which is twice the task's — so the nearest reading a
 // test outside the frame loop can take is the tolerance plus one of those frames. What the tolerance itself
 // does is pinned exactly by the unit test over achieveHeadingStep.
 expect(ordered.heading).toBeLessThanOrEqual(.45);

 // CTaskComplexSequence: the tasks run one after another, in the order they were queued.
 const sequenced=await page.evaluate(async({ped}:{ped:number})=>{
  const game=(window as any).__game,browserPed=game.missionForProfiling().peds.entity(ped),peds=game.pedestrians();
  peds.giveSequence(browserPed,[{kind:'standStill',seconds:.4},{kind:'achieveHeading',degrees:180},
   {kind:'standStill',seconds:.4}],false);
  const seen:string[]=[];
  const deadline=Date.now()+20000;
  while(Date.now()<deadline&&browserPed.sequence){
   const kind=browserPed.order?.kind??null;
   if(kind&&seen[seen.length-1]!==kind)seen.push(kind);
   await new Promise(r=>setTimeout(r,16));
  }
  return {seen,sequence:browserPed.sequence??null,order:browserPed.order??null};
 },{ped:made.ped});
 expect(sequenced.seen).toEqual(['standStill','achieveHeading','standStill']);
 // A sequence that does not repeat is gone once its last task ends, and the ped has no order left.
 expect(sequenced.sequence).toBe(null);expect(sequenced.order).toBe(null);

 // GIVE_WEAPON_TO_CHAR: the type and the ammo are the ped's at once, and the held model follows.
 const armed=await page.evaluate(async({ped}:{ped:number})=>{
  const game=(window as any).__game,peds=game.pedestrians(),browserPed=game.missionForProfiling().peds.entity(ped);
  // eWeaponType 22 is the pistol, which is what the browser's own officers carry.
  peds.giveWeapon(browserPed,22,40);
  const atOnce={type:browserPed.weaponType,ammo:browserPed.totalAmmo,held:!!browserPed.weapon};
  const deadline=Date.now()+20000;
  while(Date.now()<deadline&&!browserPed.weapon)await new Promise(r=>setTimeout(r,200));
  // CLEAR_CHAR_TASKS drops the order and leaves the ped to wander.
  peds.giveOrder(browserPed,{kind:'standStill',seconds:Infinity});
  const ordered=browserPed.order?.kind??null;
  peds.clearTasks(browserPed);
  return {atOnce,held:!!browserPed.weapon,ammo:browserPed.totalAmmo,ordered,cleared:browserPed.order??null};
 },{ped:made.ped});
 expect(armed.atOnce).toEqual({type:22,ammo:40,held:false});
 expect(armed.held).toBe(true);expect(armed.ammo).toBe(40);
 expect(armed.ordered).toBe('standStill');expect(armed.cleared).toBe(null);

 // CREATE_CHAR_INSIDE_CAR: the ped rides where the car is, and the occupant renderer draws it in its seat.
 const riding=await page.evaluate(async({car}:{car:number})=>{
  const mission=(window as any).__game.missionForProfiling();
  const handle=mission.peds.createInCar(4,'male01',car,'driver');
  const deadline=Date.now()+20000;
  while(Date.now()<deadline&&!mission.peds.entity(handle))await new Promise(r=>setTimeout(r,200));
  const at=mission.peds.positionOf(handle),carAt=mission.vehicles.positionOf(car);
  return {ride:mission.peds.rideOf(handle),exists:mission.peds.exists(handle),
   // GetCharCoordinates gives the car's position while the ped rides in it.
   sameAsCar:Math.hypot(at.x-carAt.x,at.y-carAt.y,at.z-carAt.z),
   health:mission.peds.healthOf(handle),handle};
 },{car:made.car});
 expect(riding.ride).toEqual({vehicle:made.car,seat:'driver'});
 expect(riding.exists).toBe(true);
 expect(riding.sameAsCar).toBeLessThan(.001);
 expect(riding.health).toBe(100);

 // CHANGE_CAR_COLOUR: the two paint slots take the palette entries the script names.
 const painted=await page.evaluate(({car}:{car:number})=>{
  const game=(window as any).__game,mission=game.missionForProfiling();
  const target=mission.vehicles.entity(car);
  const before=target.assets.colors.map((rgb:number[])=>[...rgb]);
  const adapter=(mission as any).runtime.world;
  adapter.changeVehicleColour(car,1,3);
  const after=target.assets.colors.map((rgb:number[])=>[...rgb]);
  const palette=game.fleet().catalog?.colors?.palette;
  return {before,after,wanted:[palette?.[1]?.rgb,palette?.[3]?.rgb]};
 },{car:made.car});
 // The first two slots are the palette entries asked for; the other two keep the car's own variation.
 expect(painted.after[0]).toEqual([...painted.wanted[0]!]);
 expect(painted.after[1]).toEqual([...painted.wanted[1]!]);
 expect(painted.after[2]).toEqual(painted.before[2]);
 expect(painted.after[3]).toEqual(painted.before[3]);

 // Deleting takes both out of the world and out of the script's reach.
 const gone=await page.evaluate(({car,ped}:{car:number;ped:number})=>{
  const mission=(window as any).__game.missionForProfiling();
  mission.vehicles.delete(car);mission.peds.delete(ped);
  return {car:mission.vehicles.exists(car),ped:mission.peds.exists(ped),
   peds:mission.peds.count,cars:mission.vehicles.count};
 },{car:made.car,ped:made.ped});
 expect(gone.car).toBe(false);expect(gone.ped).toBe(false);
 expect(errors).toEqual([]);
});
