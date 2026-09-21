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

 // CTaskSimpleAchieveHeading through the order the translation produces: the ped turns to face north and
 // stops within the task's own tolerance, and stands where it is while it does.
 const ordered=await page.evaluate(async({ped}:{ped:number})=>{
  const game=(window as any).__game,mission=game.missionForProfiling(),browserPed=mission.peds.entity(ped);
  mission.peds.setHealth(ped,250);
  game.pedestrians().giveOrder(browserPed,{kind:'achieveHeading',degrees:0});
  const started=browserPed.order?.kind??null,at={...browserPed.actor.player.position};
  const deadline=Date.now()+8000;
  while(Date.now()<deadline&&browserPed.order)await new Promise(r=>setTimeout(r,100));
  const heading=browserPed.actor.player.heading,moved=Math.hypot(browserPed.actor.player.position.x-at.x,browserPed.actor.player.position.z-at.z);
  return {health:mission.peds.healthOf(ped),started,finished:!browserPed.order,
   // A script heading of nothing is the browser's yaw of half a turn.
   heading:Math.abs(Math.atan2(Math.sin(heading-Math.PI),Math.cos(heading-Math.PI))),moved};
 },{ped:made.ped});
 expect(ordered.health).toBe(250);
 expect(ordered.started).toBe('achieveHeading');
 expect(ordered.finished).toBe(true);
 expect(ordered.heading).toBeLessThanOrEqual(.2);
 expect(ordered.moved).toBeLessThan(.5);

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
