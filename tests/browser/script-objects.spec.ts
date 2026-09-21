import {test,expect} from '@playwright/test';
/** CREATE_OBJECT gives the script an object the runtime keeps everything about; the browser draws it where
 * those records say it is. This makes one beside the player and watches it appear, move and go. */
test('an object the script makes is drawn where the script puts it',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);

 // Model 1337 is a street bin, which every region of the archive carries.
 const made=await page.evaluate(()=>{
  const game=(window as any).__game,mission=game.missionForProfiling(),p=game.state().player.position;
  const at={x:p.x+4,y:-p.z,z:p.y};
  const object=mission.runtime.game.objects.create(1337,at,{external:false,missionCleanup:false});
  return {handle:object.handle,at,count:mission.scriptObjects().length};
 });
 // The script's own opening already made objects of its own, so this one joins them rather than being alone.
 expect(made.count).toBeGreaterThanOrEqual(1);

 // The browser loads the model and puts the object where the script said.
 const drawn=await page.evaluate(async({handle,at}:{handle:number;at:{x:number;y:number;z:number}})=>{
  const game=(window as any).__game;
  const views=()=>game.scriptObjectViews?.();
  const deadline=Date.now()+45000;
  while(Date.now()<deadline&&(views()?.drawn??0)<1)await new Promise(r=>setTimeout(r,250));
  const view=views();
  const group=view?.groupFor?.(handle);
  return {drawn:view?.drawn??0,error:view?.error??null,
   // Renderer axes: the script's z is up here and its y runs the other way.
   position:group?{x:group.position.x,y:group.position.y,z:group.position.z}:null,expected:{x:at.x,y:at.z,z:-at.y}};
 },{handle:made.handle,at:made.at});
 expect(drawn.error).toBe(null);
 expect(drawn.drawn).toBeGreaterThanOrEqual(1);
 expect(drawn.position).not.toBe(null);
 expect(Math.hypot(drawn.position!.x-drawn.expected.x,drawn.position!.y-drawn.expected.y,drawn.position!.z-drawn.expected.z)).toBeLessThan(.001);

 // Moving the object in the script moves what is drawn, and deleting it takes the drawing away.
 const moved=await page.evaluate(async({handle}:{handle:number})=>{
  const game=(window as any).__game,mission=game.missionForProfiling();
  const record=mission.runtime.game.objects.at(handle);
  record.position={x:record.position.x+10,y:record.position.y,z:record.position.z};
  await new Promise(r=>setTimeout(r,500));
  const group=game.scriptObjectViews().groupFor(handle);
  const after={x:group.position.x,y:group.position.y,z:group.position.z};
  mission.runtime.game.objects.remove(handle);
  await new Promise(r=>setTimeout(r,500));
  return {after,drawn:game.scriptObjectViews().drawn,gone:!game.scriptObjectViews().groupFor(handle)};
 },{handle:made.handle});
 expect(moved.after.x).toBeCloseTo(drawn.expected.x+10,3);
 expect(moved.gone).toBe(true);
 // ATTACH_OBJECT_TO_CAR: the object hangs from the car at an offset in the car's own axes and follows it.
 const hung=await page.evaluate(async()=>{
  const game=(window as any).__game,mission=game.missionForProfiling(),p=game.state().player.position;
  const car=mission.vehicles.create(411,{x:p.x+6,y:-p.z,z:p.y},0);
  const deadline=Date.now()+45000;
  while(Date.now()<deadline&&!mission.vehicles.entity(car))await new Promise(r=>setTimeout(r,250));
  if(!mission.vehicles.entity(car))return {built:false};
  const object=mission.runtime.game.objects.create(1337,{x:0,y:0,z:0},{external:false,missionCleanup:false});
  // Two units above the car's own origin, and nothing to either side.
  mission.runtime.game.objects.attach(object.handle,'vehicle',car,{x:0,y:0,z:2},{x:0,y:0,z:0});
  await new Promise(r=>setTimeout(r,600));
  const at=mission.vehicles.positionOf(car),on=mission.runtime.game.objects.at(object.handle).position;
  const before={...on};
  mission.vehicles.setPosition(car,{x:at.x+15,y:at.y,z:at.z});
  await new Promise(r=>setTimeout(r,600));
  const moved=mission.runtime.game.objects.at(object.handle).position;
  mission.runtime.game.objects.detach(object.handle);
  const carNow=mission.vehicles.positionOf(car);
  mission.vehicles.setPosition(car,{x:carNow.x+15,y:carNow.y,z:carNow.z});
  await new Promise(r=>setTimeout(r,600));
  const afterDetach=mission.runtime.game.objects.at(object.handle).position;
  mission.runtime.game.objects.remove(object.handle);mission.vehicles.delete(car);
  return {built:true,liftedAbove:before.z-at.z,followed:moved.x-before.x,stayed:afterDetach.x-moved.x};
 });
 expect(hung.built).toBe(true);
 // The offset is in the car's own axes, so two up puts it two above the car.
 expect(hung.liftedAbove).toBeCloseTo(2,1);
 // The car moved fifteen east and the object went with it; once let go it stopped following.
 expect(hung.followed).toBeGreaterThan(10);
 expect(Math.abs(hung.stayed!)).toBeLessThan(.001);

 expect(errors).toEqual([]);
});
