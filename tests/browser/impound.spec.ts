import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';

const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());
/** The Los Santos impound (imp_la, type 33): x 1523.92 to 1556.92, y -1653.23 to -1633.23, floor 4.73, roof 12.23. Its
 * cars line up 4 units apart about (1540.42, -1643.23). */
const impound=(page:Page)=>page.evaluate(()=>{const garages=(window as any).__game.missionForProfiling().runtime.game.garages,g=garages.garages.find((x:any)=>x.name==='imp_la');
 return {state:g.doorState,kept:garages.storedCars[12].filter(Boolean).map((c:any)=>c.model)};});
const landstalkers=(page:Page)=>page.evaluate(()=>[...(window as any).__game.fleet().cars].filter((c:any)=>c.modelId===400&&!c.disposed).map((c:any)=>{const t=c.car.body.translation();
 return {x:t.x,y:t.y,z:t.z,impounded:c.impounded,interesting:(window as any).__game.fleet().isVehicleOfInterest(c)};}));

// CGarages::StoreCarInNearestImpoundingGarage and the impound case of CGarage::Update (iOS): a car CJ has just driven,
// taken off the street by an area clear, goes to the nearest impound; walking into the Los Santos impound brings it
// back, lined up and on its wheels, and walking off keeps it again.
test('a car of the player\'s cleared off the street turns up in the Los Santos impound',async({page})=>{
 test.setTimeout(420000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.fleet()&&!!(window as any).__game.missionForProfiling()?.runtime),{timeout:60000}).toBe(true);
 expect(await impound(page)).toEqual({state:0,kept:[]});
 // A Landstalker in an El Corona street, let go as a script lets go of its car, and CJ in it and out again.
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(1829.9,g.groundAt(1829.9,1858.1,20)+.05,1858.1);});
 await expect.poll(async()=>{const s=await state(page);return !s.terrainHold&&s.player.grounded;},{timeout:120000}).toBe(true);
 // The street's collision streamed in under where the car goes.
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.groundAt(1825.5,1858.1,20)),{timeout:60000}).toBeGreaterThan(10);
 await page.evaluate(async()=>{const g=(window as any).__game,car=await g.fleet().spawnScriptCar(400,{x:1825.5,y:g.groundAt(1825.5,1858.1,20),z:1858.1},0);car.missionCar=false;});
 await expect.poll(async()=>(await landstalkers(page)).length,{timeout:60000}).toBe(1);
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(1823.2,g.groundAt(1823.2,1858.1,20)+.05,1858.1);g.turnPlayer(Math.PI/2);});
 await expect.poll(async()=>{const s=await state(page);return !s.terrainHold&&s.player.grounded;},{timeout:30000}).toBe(true);
 await page.locator('canvas.world').click({position:{x:400,y:300}});
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state(page)).carEntry.phase,{timeout:60000}).toBe('seated');
 // Driven, it is one of his cars of interest (RegisterVehicleOfInterest).
 await expect.poll(async()=>(await landstalkers(page))[0]?.interesting,{timeout:30000}).toBe(true);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state(page)).carEntry.phase,{timeout:30000}).toBe(null);
 // CLEAR_AREA where it stands: it goes, and the nearest impound (Los Santos) keeps it.
 await page.evaluate(()=>{const g=(window as any).__game,car=[...g.fleet().cars].find((c:any)=>c.modelId===400&&!c.disposed),t=car.car.body.translation();g.fleet().clearCarsInArea({x:t.x,z:t.z},5);});
 await expect.poll(()=>impound(page),{timeout:10000}).toEqual({state:0,kept:[400]});
 expect(await landstalkers(page)).toEqual([]);
 // CJ in the impound, between its floor and roof: the Landstalker stands at the head of the line, impounded.
 // (Over the impound first, held, until its collision has streamed in; then onto its floor.)
 await page.evaluate(()=>{(window as any).__game.placePlayer(1550,7,1637);});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.groundAt(1550,1637,10)),{timeout:120000}).toBeGreaterThan(4.73);
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(1550,g.groundAt(1550,1637,10)+.05,1637);});
 await expect.poll(async()=>{const s=await state(page);return !s.terrainHold&&s.player.grounded;},{timeout:120000}).toBe(true);
 expect((await state(page)).player.position.y).toBeGreaterThan(4.73);
 await expect.poll(()=>impound(page),{timeout:30000}).toEqual({state:1,kept:[]});
 const restored=async()=>(await landstalkers(page)).filter(c=>c.impounded);
 await expect.poll(async()=>(await restored()).length,{timeout:30000}).toBe(1);
 const back=(await restored())[0];
 expect(Math.hypot(back.x-1536.42,back.z-1643.23)).toBeLessThan(.5);expect(back.impounded).toBe(true);
 // Set down on the floor (PlaceOnRoadProperly), not dropped through it or left in the air: once its collision is in it
 // rests on its wheels.
 await page.waitForTimeout(3000);
 const settled=(await restored())[0],floor=await page.evaluate(()=>(window as any).__game.groundAt(1536.42,1643.23,10));
 expect(settled.y-floor).toBeGreaterThan(.2);expect(settled.y-floor).toBeLessThan(1.5);expect(Math.hypot(settled.x-back.x,settled.z-back.z)).toBeLessThan(.3);
 await page.screenshot({path:'artifacts/impound-restored.png'});
 // Walking off (here: put back on the street) keeps it again, with any other car standing in the lot (a parked one
 // the lot's generator made may be there too).
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(1823.2,g.groundAt(1823.2,1858.1,20)+.05,1858.1);});
 await expect.poll(async()=>(await impound(page)).state,{timeout:30000}).toBe(0);
 expect((await impound(page)).kept).toContain(400);
 expect(await restored()).toEqual([]);
 expect(errors).toEqual([]);
});
