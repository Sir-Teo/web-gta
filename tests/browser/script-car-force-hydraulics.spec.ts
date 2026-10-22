import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** APPLY_FORCE_TO_CAR (LOWR and SWEET6's spring back to the dancer's spot, ZERO4, DES3): CPhysical::ApplyForce with the
 * effective mass at the application point. A central force changes move speed directly; an offset turns it.
 * CONTROL_CAR_HYDRAULICS (LOWR, SWEET6): the corners a mission car an AI drives lifts, used up each step. */
test('a script pushes a car, turns it with an offset, and works a driven lowrider\'s hydraulics',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.setPlayerControl(0,false));
 const made=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position;
  return {car:m.vehicles.create(596,{x:p.x+8,y:-p.z,z:-100},0),low:m.vehicles.create(536,{x:p.x+8,y:-p.z+8,z:-100},0),ped:m.peds.create(4,'MALE01',{x:p.x+4,y:-p.z+6,z:p.y})};});
 await page.waitForFunction(m=>{const g=(window as any).__game.missionForProfiling();return [m.car,m.low].every((c:number)=>g.vehicles.entity(c)?.car.body.isEnabled())&&!!g.peds.entity(m.ped);},made,{timeout:60000});
 await page.waitForTimeout(1500);
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 // Straight up by 0.1 a frame: 5 a second upward at once.
 const {before,pushed,turned}=await page.evaluate(h=>{const g=(window as any).__game,m=g.missionForProfiling(),b=m.vehicles.entity(h).car.body,w=m.runtime.world;
  const read=()=>{const v=b.linvel(),a=b.angvel();return{vy:v.y,spin:Math.hypot(a.x,a.y,a.z)};};
  const before=read();w.applyForceToVehicle(h,{x:0,y:0,z:.1},{x:0,y:0,z:0});const pushed=read();
  w.applyForceToVehicle(h,{x:.05,y:0,z:0},{x:0,y:2,z:0});return{before,pushed,turned:read()};},made.car);
 expect(pushed.vy-before.vy).toBeGreaterThan(4.5);
 expect(turned.spin).toBeGreaterThan(pushed.spin+.1);
 // The lowrider with hydraulics and a ped at the wheel: the script's left corners rise above the right ones.
 await w('setVehicleHydraulics',made.low,true);
 expect(await w('vehicleHasHydraulics',made.low)).toBe(true);
 await w('warpPedIntoCar',made.ped,made.low);
 await page.waitForTimeout(500);
 const roll=()=>w('vehicleRoll',made.low);
 const flat=await roll();
 for(let k=0;k<40;k++){await w('controlVehicleHydraulics',made.low,1,1,0,0);await page.waitForTimeout(50);}
 const tilted=await roll();
 expect(Math.abs(tilted-flat)).toBeGreaterThan(2);
 // Reset: it sits again, level.
 await w('resetVehicleHydraulics',made.low);
 await expect.poll(async()=>Math.abs((await roll())-flat),{timeout:10000}).toBeLessThan(2);
 expect(errors).toEqual([]);
});
