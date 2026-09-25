import {test,expect} from '@playwright/test';
/** CStuckCarCheck: a driven car that stays put through its check time is stuck (IS_CAR_STUCK), and one added
 * WITH_WARP is put back on a car node near where it was, once neither it nor the node is on screen. */
test('a stuck script car out of sight is warped onto a road node',async({page})=>{
 test.setTimeout(240000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 const car=await page.evaluate(()=>{
  const game=(window as any).__game,m=game.missionForProfiling(),p=game.state().player.position;
  return m.vehicles.create(400,{x:p.x,y:-p.z-30,z:p.y},0);
 });
 await page.waitForFunction(car=>!!(window as any).__game.missionForProfiling().vehicles.entity(car),car,{timeout:45000});
 const driver=await page.evaluate(car=>(window as any).__game.missionForProfiling().peds.createInCar(4,'male01',car,'driver'),car);
 await page.waitForFunction(driver=>!!(window as any).__game.missionForProfiling().peds.entity(driver),driver,{timeout:45000});
 const made={car,driver};
 // The car paths stream in once a mission runs.
 await expect.poll(()=>page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().runtime.world.nthClosestVehicleNode(p.x,-p.z,p.y,1).x!==0;}),{timeout:30000}).toBe(true);
 // Somewhere round the player that the camera does not see.
 const hidden=await page.evaluate(({car})=>{
  const g=(window as any).__game,m=g.missionForProfiling(),w=m.runtime.world,p=g.state().player.position;
  // Neither the car nor the road node nearest it in view (AttemptToWarpVehicle refuses a node the camera sees).
  for(const r of [35,60,90,120])for(let a=0;a<16;a++){
   const at={x:p.x+Math.sin(a/16*2*Math.PI)*r,y:-p.z+Math.cos(a/16*2*Math.PI)*r,z:p.y+1};
   const node=w.carPlacementNode(at,0);if(!node||w.isSphereVisible(node,4))continue;
   m.vehicles.setPosition(car,{...node,z:node.z+1});if(!w.vehicleIsOnScreen(car))return node;
  }
  return undefined;
 },made);
 expect(hidden).toBeDefined();
 expect(await page.evaluate(({car})=>(window as any).__game.missionForProfiling().runtime.world.vehicleHasDriver(car),made)).toBe(true);
 await page.waitForTimeout(1500);
 const before=await page.evaluate(({car})=>(window as any).__game.missionForProfiling().vehicles.positionOf(car),made);
 // ADD_STUCK_CAR_CHECK_WITH_WARP car 1.0 1000 stuck, not flipped, not in water, five nodes.
 await page.evaluate(({car,before})=>{const m=(window as any).__game.missionForProfiling();
  m.runtime.game.stuckCars.add(car,before,0,1,1000,{stuck:true,flipped:false,inWater:false,nodesToCheck:5});},{...made,before});
 await expect.poll(()=>page.evaluate(({car,before})=>{const p=(window as any).__game.missionForProfiling().vehicles.positionOf(car);return Math.hypot(p.x-before.x,p.y-before.y);},{...made,before}),{timeout:20000}).toBeGreaterThan(2);
 const after=await page.evaluate(({car})=>(window as any).__game.missionForProfiling().vehicles.positionOf(car),made);
 // On a road node within reach of where it stood, the right way up.
 const near=await page.evaluate(({after})=>{const w=(window as any).__game.missionForProfiling().runtime.world;
  const nodes=[1,2,3,4,5,6].map(n=>w.nthClosestVehicleNode(after.x,after.y,after.z,n));return Math.min(...nodes.map((q:any)=>Math.hypot(q.x-after.x,q.y-after.y)));},{after});
 expect(near).toBeLessThan(8);
 expect(Math.hypot(after.x-before.x,after.y-before.y)).toBeLessThan(150);
 expect(errors).toEqual([]);
});
