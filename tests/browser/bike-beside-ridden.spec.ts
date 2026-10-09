import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** INTRO1 parks CJ's BMX in a row with the three his homies ride, 2.5 units apart. The enter button used to take the
 * nearest bike only and, finding its saddle taken by a script ped, board nothing: standing at the homies' end of the
 * row, CJ could not get on his bike at all. The nearest bike he can board is the one taken. */
test('the enter button passes over a bike a script ped rides for the free one beside it',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 // On Grove Street's open road (native 2475, -1660): where a new game sets CJ down is against a yard fence, and the row
 // east of him stood behind it.
 await page.evaluate(()=>{const g=(window as any).__game,x=2475,z=1660;g.placePlayer(x,g.groundAt(x,z,20)+.05,z);});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.sim.player.grounded),{timeout:15000}).toBe(true);
 const start=await page.evaluate(()=>({...(window as any).__game.sim.player.position}));
 const made=await page.evaluate(()=>{
  const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position;
  // Native frame: x east, y north (the renderer's -z). As INTRO1 parks them, the bikes stand in a row 2.5 units apart,
  // here 2 units east of CJ: the ridden one level with him, the free one to the south.
  // Each on the ground at CJ's level (a search from the sky can find a roof there).
  const at=(x:number,y:number)=>({x,y,z:g.groundAt(x,-y,p.y+3)+.6});
  return {ridden:m.vehicles.create(481,at(p.x+2,-p.z),0),free:m.vehicles.create(481,at(p.x+2,-p.z-2.5),0),ped:m.peds.create(4,'MALE01',{x:p.x+4,y:-p.z+2,z:p.y})};
 });
 await page.waitForFunction(({ridden,free,ped})=>{const m=(window as any).__game.missionForProfiling();return !!m.vehicles.entity(ridden)&&!!m.vehicles.entity(free)&&!!m.peds.entity(ped);},made,{timeout:60000});
 await page.evaluate(({ped,ridden})=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(ped,{kind:'enterCarAsDriver',vehicle:ridden,time:-1},0x05cb),made);
 await expect.poll(()=>page.evaluate(({ped,ridden})=>(window as any).__game.missionForProfiling().runtime.world.pedVehicle(ped)===ridden,made),{timeout:60000}).toBe(true);
 // CJ faces the row, nearer the ridden bike than the free one.
 const near=await page.evaluate(({ridden,free})=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.sim.player.position;g.turnPlayer(Math.PI/2+.3);
  const d=(h:number)=>{const b=m.vehicles.entity(h).body.translation();return Math.hypot(b.x-p.x,b.z-p.z);};return {ridden:d(ridden),free:d(free)};},made);
 expect(near.ridden).toBeLessThan(near.free);
 await page.locator('canvas.world').click({position:{x:400,y:300}});
 await page.keyboard.press('KeyF');
 await expect.poll(()=>page.evaluate(({free})=>{const g=(window as any).__game;return g.fleet().occupiedBike===g.missionForProfiling().vehicles.entity(free);},made),{timeout:30000}).toBe(true);
 // The homie keeps his saddle.
 expect(await page.evaluate(({ped,ridden})=>(window as any).__game.missionForProfiling().runtime.world.pedVehicle(ped)===ridden,made)).toBe(true);
 // Off again, then from eight units away the button walks CJ up to the free bike and puts him on it (a bike used to
 // need him within four).
 await page.keyboard.press('KeyF');
 await expect.poll(()=>page.evaluate(()=>!(window as any).__game.fleet().occupiedBike&&!(window as any).__game.bikeMount().active),{timeout:30000}).toBe(true);
 const far=await page.evaluate(({free,start})=>{const g=(window as any).__game,b=g.missionForProfiling().vehicles.entity(free).body.translation();
  // Seven units out along the line from the bike through where CJ started, on the cul-de-sac's open ground; the cars
  // parked there are taken out of his consideration (SET_CAR_... as a script does), so the button's choice is the bike.
  for(const c of g.fleet().cars)c.consideredByPlayer=false;
  const l=Math.hypot(start.x-b.x,start.z-b.z)||1,x=b.x+(start.x-b.x)/l*7,z=b.z+(start.z-b.z)/l*7;
  g.placePlayer(x,(g.groundAt(x,z,start.y+3)??start.y)+.05,z);g.turnPlayer(Math.atan2(b.x-x,b.z-z));const p=g.sim.player.position;return Math.hypot(b.x-p.x,b.z-p.z);},{...made,start});
 expect(far).toBeGreaterThan(6);
 await expect.poll(()=>page.evaluate(()=>{const s=(window as any).__game.sim;return s.knockdown===0&&s.player.grounded;}),{timeout:15000}).toBe(true);
 await page.waitForTimeout(300);await page.keyboard.press('KeyF');
 await expect.poll(()=>page.evaluate(({free})=>{const g=(window as any).__game;return g.fleet().occupiedBike===g.missionForProfiling().vehicles.entity(free);},made),{timeout:30000}).toBe(true);
 expect(errors).toEqual([]);
});
