import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';

const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());
const mission=(page:Page)=>page.evaluate(()=>{
 const g=(window as any).__game,m=g.missionForProfiling(),fare=m.peds.handles[0];
 return {threads:m.runtime.active.map((a:any)=>a.thread.name as string),gaveUp:m.snapshot().gaveUp,brief:m.runtime.game.messages.briefs[0]?.key as string|undefined,
  money:g.sim.money as number,fare:fare as number|undefined,riding:fare!==undefined&&!!m.peds.rideOf(fare)};
});
/** Free roam with CJ at the wheel of a script-made car of the model, standing on the open street outside his house. */
async function atTheWheel(page:Page,model:number){
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).pedestrians?.ready,{timeout:60000}).toBe(true);
 const car=await page.evaluate(m=>(window as any).__game.missionForProfiling().vehicles.create(m,{x:2482,y:-1666,z:-100},90),model);
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),car,{timeout:60000});
 await page.waitForTimeout(1500);
 await page.evaluate(car=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCar(1,car),car);
 await expect.poll(async()=>((await state(page)).fleet?.cars??[]).some((c:any)=>c.modelId===model&&c.occupied),{timeout:30000}).toBe(true);
 await page.waitForTimeout(2500);
 return car as number;
}
const moveCar=(page:Page,car:number,at:{x:number;y:number;z:number})=>page.evaluate(({car,at})=>{
 const w=(window as any).__game.missionForProfiling().runtime.world;w.setVehicleCoordinates(car,at.x,at.y,at.z<=-100?w.groundZForCoord(at.x,at.y):at.z);
},{car,at});

// MAIN's R3 thread starts the taxi mission on the sub-mission key under `IF NOT IS_PLAYER_IN_SHORTCUT_TAXI`, a cut
// command that still has to answer. The fare is a street ped GET_RANDOM_CHAR_IN_ZONE hands the script.
test('the sub-mission key starts the taxi job: a fare boards, is driven to his stop and pays',async({page})=>{
 test.setTimeout(420000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const car=await atTheWheel(page,420);
 await page.keyboard.down('Digit2');await page.waitForTimeout(600);await page.keyboard.up('Digit2');
 await expect.poll(async()=>(await mission(page)).threads,{timeout:30000}).toContain('TAXIODD');
 // A fare is chosen among the street's peds (TX_PKUP, "Look for a fare").
 await expect.poll(async()=>(await mission(page)).fare,{timeout:90000}).not.toBeUndefined();
 const before=await mission(page);
 const fareAt=await page.evaluate(h=>(window as any).__game.missionForProfiling().peds.positionOf(h),before.fare!);
 await moveCar(page,car,{x:fareAt.x+3,y:fareAt.y,z:fareAt.z});
 await expect.poll(async()=>(await mission(page)).riding,{timeout:60000}).toBe(true);
 // The destination is the mission's own coordinate blip (no sprite, long range).
 const dest=await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.game.radar.traces.find((t:any)=>t.tracking&&t.position&&!(t.entityHandle>0)&&!t.sprite&&!t.shortRange)?.position);
 expect(dest).toBeTruthy();
 await moveCar(page,car,dest);
 await expect.poll(async()=>(await mission(page)).money,{timeout:120000}).toBeGreaterThan(before.money);
 const after=await mission(page);
 expect(after.threads).toContain('TAXIODD');expect(after.gaveUp).toEqual([]);
 expect(errors).toEqual([]);
});

// FIRETRU: START_CAR_FIRE puts a script fire on the burning car, GET_CLOSEST_STRAIGHT_ROAD finds it a road, the zone's
// name goes into the "burning vehicle reported in ..." line, and the truck's water cannon puts the fire out.
test('the fire truck job names a burning car and pays when the cannon puts it out',async({page})=>{
 test.setTimeout(420000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const truck=await atTheWheel(page,407);
 await page.keyboard.down('Digit2');await page.waitForTimeout(600);await page.keyboard.up('Digit2');
 await expect.poll(async()=>(await mission(page)).threads,{timeout:30000}).toContain('FIRETRU');
 await expect.poll(async()=>(await mission(page)).brief,{timeout:60000}).toBe('F_START');
 const fire=()=>page.evaluate(()=>{
  const g=(window as any).__game,m=g.missionForProfiling(),t=m.runtime.game.radar.traces.find((t:any)=>t.tracking&&t.entityHandle>0);
  return t&&m.vehicles.exists(t.entityHandle)?{at:m.vehicles.positionOf(t.entityHandle),fires:m.scriptFires().length as number}:null;
 });
 await expect.poll(fire,{timeout:60000}).not.toBeNull();
 const burning=(await fire())!;expect(burning.fires).toBeGreaterThan(0);
 const before=await mission(page);
 // Nineteen units short of it, facing it: the jet comes down on the car from there.
 await page.evaluate(({car,p})=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.setVehicleCoordinates(car,p.x,p.y-19,p.z);w.setVehicleHeading?.(car,0);},{car:truck,p:burning.at});
 await page.waitForTimeout(3000);
 await page.keyboard.down('ControlLeft');
 await expect.poll(async()=>(await mission(page)).money,{timeout:90000}).toBeGreaterThan(before.money);
 await page.keyboard.up('ControlLeft');
 const after=await mission(page);expect(after.threads).toContain('FIRETRU');expect(after.gaveUp).toEqual([]);
 expect(errors).toEqual([]);
});

// AMBULAN and COPCAR start from their vehicles and run on without stopping on a command (their patients and
// criminals are made hundreds of units off, where they wait for their collision as a mission entity does).
for(const [model,thread] of [[416,'AMBULAN'],[596,'COPCAR']] as const){
 test(`the sub-mission key starts ${thread} and it keeps running`,async({page})=>{
  test.setTimeout(300000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await atTheWheel(page,model);
  await page.keyboard.down('Digit2');await page.waitForTimeout(600);await page.keyboard.up('Digit2');
  await expect.poll(async()=>(await mission(page)).threads,{timeout:30000}).toContain(thread);
  await page.waitForTimeout(12000);
  const s=await mission(page);expect(s.threads).toContain(thread);expect(s.gaveUp).toEqual([]);
  expect(errors).toEqual([]);
 });
}

// food_vendor.scm, started by the object brain on a street cart: the vendor is made beside it out of sight, and a
// dollar at the counter side buys fifty health.
test('a chilli dog cart on the beach front sells CJ a snack',async({page})=>{
 test.setTimeout(420000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 // Santa Maria Beach: the cart stands at (389, -2072). CJ is set down forty units off, where its brain's radius (70)
 // reaches him and the vendor's spot is off screen behind him.
 const stand=async(x:number,y:number)=>{
  await page.evaluate(([x,y])=>(window as any).__game.placePlayer(x,60,-y),[x,y]);
  await expect.poll(()=>page.evaluate(([x,y])=>(window as any).__game.groundAt(x,-y,400)??null,[x,y]),{timeout:120000}).not.toBeNull();
  await page.evaluate(([x,y])=>{const g=(window as any).__game;g.placePlayer(x,g.groundAt(x,-y,400),-y);},[x,y]);
 };
 await stand(389,-2032);
 const cart=()=>page.evaluate(()=>(window as any).__game.missionForProfiling().brainObjectsSnapshot().find((b:any)=>b.model==='CHILLIDOGCART')??null);
 await expect.poll(cart,{timeout:120000}).not.toBeNull();
 await expect.poll(async()=>(await mission(page)).threads,{timeout:60000}).toContain('FODVEND');
 // The vendor (a script ped) appears once his spot is clear and unseen.
 await expect.poll(async()=>(await mission(page)).fare,{timeout:120000}).not.toBeUndefined();
 const c=(await cart())!;
 await page.evaluate(()=>{const g=(window as any).__game;g.sim.money=10;g.sim.player.health=40;});
 // The counter side: one unit along the cart's right (GET_OFFSET_FROM_OBJECT_IN_WORLD_COORDS 1 0 0).
 const h=c.heading*Math.PI/180;
 await stand(c.position.x+Math.cos(h),c.position.y+Math.sin(h));
 await expect.poll(async()=>(await mission(page)).money,{timeout:60000}).toBe(9);
 expect(await page.evaluate(()=>(window as any).__game.sim.player.health)).toBeGreaterThanOrEqual(90);
 expect((await mission(page)).gaveUp).toEqual([]);
 expect(errors).toEqual([]);
});
