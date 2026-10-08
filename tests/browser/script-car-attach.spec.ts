import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

/** ATTACH_CAR_TO_CAR and DETACH_CAR (DRUGS1's car carrier, DES10's tank on a train, TORENO2, HEIST4, QUARRY):
 * CPhysical::AttachEntityToEntity and PositionAttachedEntity. Neither command had a world hook. */
test('a script car attached to another rides on it, and comes off when detached',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const [carrier,load]=await page.evaluate(()=>{const w=(window as any).__game.missionForProfiling().runtime.world,p=w.pedPosition(1);return [w.createCar(443,p.x+10,p.y+6,p.z),w.createCar(560,p.x+16,p.y+6,p.z)];});
 await page.waitForFunction(([a,b])=>{const m=(window as any).__game.missionForProfiling();return !!m.vehicles.entity(a)&&!!m.vehicles.entity(b);},[carrier,load],{timeout:60000});
 await page.waitForTimeout(1000);
 // On the carrier's back, 2 up and tilted 15 degrees nose up, as DRUGS1 loads its packer.
 await page.evaluate(([a,b])=>(window as any).__game.missionForProfiling().runtime.world.attachVehicleToVehicle(b,a,{x:0,y:-4.6,z:2},{x:15,y:0,z:0}),[carrier,load]);
 const where=()=>page.evaluate(([a,b])=>{const w=(window as any).__game.missionForProfiling().runtime.world;return {a:w.vehiclePosition(a),b:w.vehiclePosition(b),pitch:w.getCarPitch?.(b)};},[carrier,load]);
 await page.waitForTimeout(500);
 const first=await where();
 // Moved 12 north: the load goes with it.
 await page.evaluate(([a])=>{const w=(window as any).__game.missionForProfiling().runtime.world,q=w.vehiclePosition(a);w.setVehicleCoordinates(a,q.x,q.y+12,q.z);},[carrier]);
 await page.waitForTimeout(1500);
 const moved=await where();
 expect(moved.b.y-first.b.y).toBeCloseTo(moved.a.y-first.a.y,0);
 expect(moved.b.z-moved.a.z).toBeGreaterThan(1);
 // Detached: it falls back to the carrier or the street.
 await page.evaluate(([b])=>(window as any).__game.missionForProfiling().runtime.world.detachVehicle(b,0,0,0,false),[load]);
 await page.waitForTimeout(3000);
 const dropped=await where();expect(dropped.b.z).toBeLessThan(moved.b.z);
 expect(errors).toEqual([]);
});
