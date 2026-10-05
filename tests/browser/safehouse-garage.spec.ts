import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
// CGarage::Update's hideout case (the iOS executable's): the Johnson house garage (cjsafe) opens for CJ walking up to
// it and shuts once he walks away. Before, a safehouse garage's door never moved.
test('the Johnson house garage opens for CJ on foot and shuts when he walks off',async({page})=>{
 test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:90000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.missionForProfiling()?.runtime),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const garage=()=>page.evaluate(()=>{const g=(window as any).__game.missionForProfiling().runtime.game.garages.garages.find((x:any)=>x.name==='cjsafe');return g&&{state:g.doorState,position:+g.doorPosition.toFixed(3)};});
 await expect.poll(garage,{timeout:30000}).toMatchObject({state:0,position:0});
 // The garage's box runs from native y -1699.36 north; CJ stands 3 units south of its door (browser z = -native y).
 const stand=(southOfDoor:number)=>page.evaluate(d=>{const g=(window as any).__game,z=1699.36+d;g.placePlayer(2505.5,g.groundAt(2505.5,z,20)+.05,z);},southOfDoor);
 await stand(3);
 await expect.poll(async()=>(await garage())?.state,{timeout:30000}).toBe(1);
 expect((await garage())?.position).toBe(1);
 // Fifteen units off on foot (past four), the door comes down and the garage is shut.
 await stand(15);
 await expect.poll(async()=>(await garage())?.state,{timeout:30000}).toBe(0);
 expect((await garage())?.position).toBe(0);
 expect(errors).toEqual([]);
});
// CStoredCar: a car left in the Johnson house garage is kept when the door comes down (taken out of the world and
// into the save) and stands there again, in its paint, when CJ comes back and the door goes up.
test('the Johnson house garage keeps a car parked in it while shut and puts it back on opening',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:90000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.missionForProfiling()?.runtime&&!!(window as any).__game.fleet()),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const garage=()=>page.evaluate(()=>{const garages=(window as any).__game.missionForProfiling().runtime.game.garages,g=garages.garages.find((x:any)=>x.name==='cjsafe');
  return g&&{state:g.doorState,kept:garages.storedCars[0].filter(Boolean).map((c:any)=>c.model)};});
 await expect.poll(garage,{timeout:30000}).toMatchObject({state:0,kept:[]});
 const stand=(southOfDoor:number)=>page.evaluate(d=>{const g=(window as any).__game,z=1699.36+d;g.placePlayer(2505.5,g.groundAt(2505.5,z,20)+.05,z);},southOfDoor);
 await stand(3);
 await expect.poll(async()=>(await garage())?.state,{timeout:30000}).toBe(1);
 // A Sadler from the cheat, set down in the middle of the garage facing in. (Other Sadlers may be about: the one
 // looked for is the one within a few units of the garage's middle, or of CJ just after the cheat.)
 const sadler=(x=2505.5,z=1695.2)=>page.evaluate(([x,z])=>{const car=[...(window as any).__game.fleet().cars].find((c:any)=>{if(c.assets.vehicle.id!==543||c.disposed)return false;const t=c.car.body.translation();return Math.hypot(t.x-x,t.z-z)<8;});
  if(!car)return null;const t=car.car.body.translation();return {handle:car.car.body.handle,x:t.x,y:t.y,z:t.z,colours:[...car.assets.colourIndices]};},[x,z]);
 await page.evaluate(()=>(window as any).__game.spawnVehicle(543));
 const cj=(await state()).player.position;
 await expect.poll(()=>sadler(cj.x,cj.z),{timeout:30000}).not.toBeNull();
 const parked=await sadler(cj.x,cj.z);
 await page.evaluate(handle=>{const g=(window as any).__game;g.placeFleetCar(`handle:${handle}`,2505.5,g.groundAt(2505.5,1695.2,15)+1.2,1695.2,0);},parked!.handle);
 await page.waitForTimeout(2000);
 // (The ground is found from under the garage roof.)
 const settled=(await sadler())!;expect(settled.handle).toBe(parked!.handle);expect(Math.abs(settled.z-1695.2)).toBeLessThan(.5);expect(settled.y).toBeLessThan(15);
 // CJ walks off: the door comes down, and the Sadler is kept and gone from the street.
 await stand(15);
 await expect.poll(garage,{timeout:30000}).toMatchObject({state:0,kept:[543]});
 expect(await sadler()).toBeNull();
 // The periodic save carries it.
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('web-gta.progress.v1')??'{}').storedCars?.[0]?.filter(Boolean).map((c:any)=>c.model)),{timeout:15000}).toEqual([543]);
 // Back to the door: the Sadler stands where it was, in its paint, before the door goes up.
 await stand(3);
 await expect.poll(async()=>(await garage())?.state,{timeout:30000}).toBe(1);
 expect((await garage())?.kept).toEqual([]);
 const back=(await sadler())!;
 expect(back).not.toBeNull();expect(Math.hypot(back.x-settled.x,back.y-settled.y,back.z-settled.z)).toBeLessThan(.2);
 expect(back.colours).toEqual(settled.colours);
 expect(errors).toEqual([]);
});
