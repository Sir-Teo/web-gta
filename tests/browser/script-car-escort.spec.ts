import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** SET_CAR_ESCORT_CAR_LEFT and _RIGHT (iOS 0x1001e9860, 0x1001e9b2c): DRIV3 has its cars ride alongside the player's;
 * the commands were skipped. They set the autopilot's target car and MISSION_ESCORT_LEFT (29) or _RIGHT (30). */
test('a script car rides at the left of the car it escorts',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 // Los Santos airport's south runway, heading east along it.
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.setPedCoordinates(1,1500,-2593,13.6));
 await page.waitForFunction(()=>{const s=(window as any).__game.state();return s.player.grounded&&!s.terrainHold;},undefined,{timeout:60000});
 const made=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position;
  // Heading 270 faces east (+x). The escort starts behind and to the side.
  const lead=m.vehicles.create(400,{x:p.x+6,y:-p.z,z:-100},270),escort=m.vehicles.create(400,{x:p.x-6,y:-p.z+8,z:-100},270),driver=m.peds.create(4,'MALE01',{x:p.x-6,y:-p.z+11,z:p.y+1});
  return {lead,escort,driver};});
 await page.waitForFunction(({lead,escort,driver}:any)=>{const m=(window as any).__game.missionForProfiling();return !!(m.vehicles.entity(lead)&&m.vehicles.entity(escort)&&m.peds.entity(driver));},made,{timeout:45000});
 await page.evaluate(({escort,driver})=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCar(driver,escort),made);
 await page.waitForFunction(({driver}:any)=>!!(window as any).__game.missionForProfiling().peds.entity(driver)?.rider,made,{timeout:30000});
 await page.evaluate(({lead})=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCar(1,lead),made);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().nativeCar?.occupied),{timeout:15000}).toBe(true);
 await page.evaluate(({escort,lead})=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.setVehicleCruiseSpeed(escort,40);w.setCarEscortCarLeft(escort,lead);},made);
 // CJ drives east down the runway; the escort keeps station on his left, north of him.
 await page.keyboard.down('KeyW');await page.waitForTimeout(4000);
 const at=await page.evaluate(({lead,escort})=>{const v=(window as any).__game.missionForProfiling().vehicles;return {lead:v.positionOf(lead),escort:v.positionOf(escort)};},made);
 await page.keyboard.up('KeyW');
 expect(at.lead.x).toBeGreaterThan(1520);
 expect(Math.hypot(at.escort.x-at.lead.x,at.escort.y-at.lead.y)).toBeLessThan(15);
 expect(at.escort.y-at.lead.y).toBeGreaterThan(1.5);
 expect(errors).toEqual([]);
});
