import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** IS_AREA_OCCUPIED (BCRASH1, CAT3, SYN1, CASINO1): CWorld::FindObjectsIntersectingCube over the lists the flags
 * name, whichever way round the corners come. IS_CAR_VISIBLY_DAMAGED (MUSIC3, SCRASH3): vehicleFlags.bIsDamaged, set
 * once a component shows its damaged atomic and cleared by a fix. */
test('a script asks whether a box holds a car, a ped or the ground, and whether a car shows damage',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().vehicles.create(400,{x:p.x+8,y:-p.z,z:-100},0);});
 await page.waitForFunction((h:number)=>!!(window as any).__game.missionForProfiling().vehicles.entity(h)?.car.body.isEnabled(),car,{timeout:60000});
 await page.waitForTimeout(1000);
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 const kinds=(k:{solid?:boolean;vehicles?:boolean;peds?:boolean;objects?:boolean})=>({solid:false,vehicles:false,peds:false,objects:false,particles:false,...k});
 const c=await w('vehiclePosition',car),me=await w('pedPosition',1);
 // A box round the car, a metre over the road: it holds the car and nothing else asked for.
 const lo={x:c.x-1,y:c.y-1,z:c.z},hi={x:c.x+1,y:c.y+1,z:c.z+1};
 expect(await w('areaIsOccupied',lo,hi,kinds({vehicles:true}))).toBe(true);
 expect(await w('areaIsOccupied',hi,lo,kinds({vehicles:true}))).toBe(true);
 expect(await w('areaIsOccupied',lo,hi,kinds({peds:true}))).toBe(false);
 // Round the player: a ped.
 expect(await w('areaIsOccupied',{x:me.x-.5,y:me.y-.5,z:me.z-.5},{x:me.x+.5,y:me.y+.5,z:me.z+.5},kinds({peds:true}))).toBe(true);
 // Down into the road: the ground is a building; high in the air, nothing.
 expect(await w('areaIsOccupied',{x:me.x-2,y:me.y-2,z:me.z-3},{x:me.x+2,y:me.y+2,z:me.z-.5},kinds({solid:true}))).toBe(true);
 expect(await w('areaIsOccupied',{x:me.x-2,y:me.y-2,z:me.z+80},{x:me.x+2,y:me.y+2,z:me.z+82},kinds({solid:true,vehicles:true,peds:true,objects:true}))).toBe(false);
 // A fresh car is not visibly damaged; a dented door shows it; a fix clears it.
 expect(await w('vehicleIsVisiblyDamaged',car)).toBe(false);
 await w('damageVehicleDoor',car,2);
 expect(await w('vehicleIsVisiblyDamaged',car)).toBe(true);
 await page.evaluate(h=>(window as any).__game.missionForProfiling().vehicles.entity(h).fix(),car);
 expect(await w('vehicleIsVisiblyDamaged',car)).toBe(false);
 expect(errors).toEqual([]);
});
