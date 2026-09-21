import {test,expect} from '@playwright/test';
/** CRadar's table is the script's; the browser's radar draws it. A blip on a coordinate stays put, one on a
 * car follows it, and removing it takes it off the radar. */
test('the blips a script sets are on the radar, and the ones tied to a car follow it',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);

 const out=await page.evaluate(async()=>{
  const game=(window as any).__game,mission=game.missionForProfiling(),p=game.state().player.position;
  const radar=mission.runtime.game.radar;
  const before=mission.radarBlips().length;
  // BLIP_COORD with BLIP_DISPLAY_BOTH, at a point beside the player.
  const at={x:p.x+5,y:-p.z,z:p.y};
  const coord=radar.setCoordBlip(4,at,3);
  const car=mission.vehicles.create(411,{x:p.x+9,y:-p.z,z:p.y},0);
  const deadline=Date.now()+45000;
  while(Date.now()<deadline&&!mission.vehicles.entity(car))await new Promise(r=>setTimeout(r,250));
  if(!mission.vehicles.entity(car))return {built:false};
  // BLIP_CAR on the car the script just made.
  const onCar=radar.setEntityBlip(1,car,3);
  const drawn=mission.radarBlips();
  const carAt=mission.vehicles.positionOf(car);
  mission.vehicles.setPosition(car,{x:carAt.x+20,y:carAt.y,z:carAt.z});
  const moved=mission.radarBlips();
  radar.clearBlip(coord>>>0);radar.clearBlip(onCar>>>0);
  const after=mission.radarBlips().length;
  mission.vehicles.delete(car);
  return {built:true,before,added:drawn.length-before,
   // Renderer axes on the radar: the script's y runs the other way.
   coordAt:drawn.find((b:any)=>Math.abs(b.x-at.x)<.001&&Math.abs(b.z+at.y)<.001)!==undefined,
   carMoved:(moved.find((b:any)=>Math.abs(b.x-(carAt.x+20))<.5)!==undefined),
   after,colours:drawn.map((b:any)=>b.colour)};
 });
 expect(out.built).toBe(true);
 // Two blips went up: one on a coordinate and one on the car.
 expect(out.added).toBe(2);
 expect(out.coordAt).toBe(true);
 expect(out.carMoved).toBe(true);
 // Removing them puts the radar back where it started.
 expect(out.after).toBe(out.before);
 // Every blip is drawn in one of CHudColours' own colours.
 for(const colour of out.colours!)expect(colour).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
 expect(errors).toEqual([]);
});
