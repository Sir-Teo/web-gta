import {test,expect} from '@playwright/test';
/** The particle systems a script makes: one standing at a point, and one hanging from a car that follows it.
 * Fx_c's own manager runs them, which is the manager the browser's explosions and skids already use. */
test('a script’s particle system plays where it put it and follows what it hangs from',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await expect.poll(async()=>await page.evaluate(()=>!!(window as any).__game.worldFx?.().manager),{timeout:60000}).toBe(true);

 const out=await page.evaluate(async()=>{
  const game=(window as any).__game,mission=game.missionForProfiling(),p=game.state().player.position;
  const at={x:p.x+3,y:-p.z,z:p.y};
  const adapter=(mission as any).runtime.world;
  // water_splash is in every effects.fxp the archive carries.
  const standing=adapter.createFxSystem('water_splash',at.x,at.y,at.z,true);
  adapter.playFxSystem(standing);
  const car=mission.vehicles.create(411,{x:p.x+8,y:-p.z,z:p.y},0);
  const deadline=Date.now()+45000;
  while(Date.now()<deadline&&!mission.vehicles.entity(car))await new Promise(r=>setTimeout(r,250));
  if(!mission.vehicles.entity(car))return {built:false};
  const hanging=adapter.createFxSystemOnCar('water_splash',car,0,0,2,true);
  adapter.playFxSystem(hanging);
  await new Promise(r=>setTimeout(r,400));
  const where=(handle:number)=>{const fx=(mission as any).scriptFx.get(handle);const m=fx.system.composite();return {x:m[9],y:m[10],z:m[11]};};
  const before=where(hanging),carAt=mission.vehicles.positionOf(car);
  mission.vehicles.setPosition(car,{x:carAt.x+12,y:carAt.y,z:carAt.z});
  await new Promise(r=>setTimeout(r,400));
  const after=where(hanging),standingAt=where(standing);
  // Killing takes the handle out of the script's reach.
  adapter.killFxSystem(standing);
  const stillThere=(mission as any).scriptFx.has(standing);
  mission.vehicles.delete(car);
  return {built:true,standingAt,expectedStanding:at,liftedAbove:before.z-carAt.z,followed:after.x-before.x,stillThere};
 });
 expect(out.built).toBe(true);
 // The standing system is where the script put it and stays there.
 expect(Math.hypot(out.standingAt!.x-out.expectedStanding!.x,out.standingAt!.y-out.expectedStanding!.y,
  out.standingAt!.z-out.expectedStanding!.z)).toBeLessThan(.001);
 // The hanging one sits two above the car's own origin and goes with it.
 expect(out.liftedAbove).toBeCloseTo(2,1);
 expect(out.followed).toBeGreaterThan(8);
 expect(out.stillThere).toBe(false);
 expect(errors).toEqual([]);
});
