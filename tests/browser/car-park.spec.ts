import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';

const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());
const carParkCars=(page:Page)=>page.evaluate(()=>[...(window as any).__game.fleet().cars].filter((c:any)=>!c.disposed&&c.carParkVehicle).map((c:any)=>{const t=c.car.body.translation();
 return {model:c.modelId,x:t.x,y:t.y,z:t.z,mission:c.missionCar,abandoned:c.abandoned};}));

// CREATE_RANDOM_CAR_FOR_CAR_PARK (the iOS handler): MAIN starts carpark1.scm while CJ is in the Las Venturas car park's
// area (x 2037.54 to 2117.18, y 2365.37 to 2483.92) once its two flags are set, and the script parks three cars on each
// storey while CJ is on it; before, it gave up at its first car, and the car park stood empty.
test('the Las Venturas car park fills with random parked cars',async({page})=>{
 test.setTimeout(300000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.fleet()),{timeout:60000}).toBe(true);
 // MAIN's test before it streams the script in: $1668 and $1672 (byte offsets), which the story sets on the way to
 // Las Venturas.
 await page.evaluate(()=>{const r=(window as any).__game.missionForProfiling().runtime,g=r.active[0].thread.globals as DataView;g.setInt32(1668,1,true);g.setInt32(1672,1,true);});
 // On the ground floor (z 9.82 to 14.12; each storey is filled while he is on it). Held over it until its collision is in.
 await page.evaluate(()=>{(window as any).__game.placePlayer(2080,11,-2392);});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.groundAt(2080,-2392,12)),{timeout:120000}).toBeGreaterThan(9);
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2080,g.groundAt(2080,-2392,12)+.05,-2392);});
 await expect.poll(async()=>{const s=await state(page);return !s.terrainHold&&s.player.grounded;},{timeout:120000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().snapshot().threads.map((t:any)=>String(t.name).toLowerCase())),{timeout:60000}).toContain('carprk1');
 await expect.poll(async()=>(await carParkCars(page)).length,{timeout:90000}).toBeGreaterThan(2);
 const cars=await carParkCars(page);
 // Random cars, not the script's: RANDOM_VEHICLE and abandoned, at the script's spots (the first at 2077.87, 2398.66).
 expect(cars.every(c=>!c.mission&&c.abandoned)).toBe(true);
 expect(cars.some(c=>Math.hypot(c.x-2077.87,c.z+2398.66)<1)).toBe(true);
 await page.waitForTimeout(3000);
 await page.screenshot({path:'artifacts/car-park.png'});
 expect(await page.evaluate(()=>(window as any).__game.missionForProfiling().snapshot().gaveUp)).not.toContainEqual(expect.objectContaining({command:'CREATE_RANDOM_CAR_FOR_CAR_PARK'}));
 expect(errors).toEqual([]);
});
