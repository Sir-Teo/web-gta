import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** ATTACH_CHAR_TO_CAR on the player (RYDER3's truck, DRUGS4, SYN2, WUZI5): CPed::AttachPedToEntity puts him on the
 * vehicle at the offset, with his collision off and the given weapon chosen; he goes where the vehicle goes; and
 * DETACH_CHAR_FROM_CAR (DettachPedFromEntity) lets him go with the weapon he had back. */
test('the player rides on a car at an offset with a given gun, and is let go with his own back',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;const inv=g.weapons().inventory;inv.give(22,40);inv.select(22);return g.missionForProfiling().vehicles.create(422,{x:p.x+8,y:-p.z,z:-100},0);});
 await page.waitForFunction((h:number)=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),car,{timeout:60000});
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 const pistol=await page.evaluate(()=>{const a=(window as any).__game.weapons().inventory.ammo.get(22);return a.clip+a.reserve;});
 // On the bed of the pickup, facing back, with an AK.
 await w('attachPedToCar',1,car,{x:0,y:-1.5,z:1.2},2,Math.PI*2,30);
 expect(await w('isCharAttachedToAnyCar',1)).toBe(true);
 expect(await page.evaluate(()=>(window as any).__game.weapons().inventory.selected)).toBe(30);
 const where=async()=>{const c=await w('vehiclePosition',car),p=await w('pedPosition',1);return {dx:p.x-c.x,dy:p.y-c.y,dz:p.z-c.z};};
 const d=await where();
 expect(Math.hypot(d.dx,d.dy+1.5)).toBeLessThan(.3);expect(Math.abs(d.dz-1.2)).toBeLessThan(.3);
 // The car moves on; he goes with it.
 const c0=await w('vehiclePosition',car);
 await w('setVehicleCoordinates',car,c0.x+20,c0.y,c0.z);
 await expect.poll(async()=>{const d=await where();return Math.hypot(d.dx,d.dy+1.5);},{timeout:15000}).toBeLessThan(.5);
 // SET_HEADING_FOR_ATTACHED_PLAYER: now facing a quarter turn anticlockwise from the car's front (its left), 10 degrees
 // either way; the view swings there and he keeps within it.
 await w('setHeadingForAttachedPlayer',0,90,10);
 const facing=()=>page.evaluate(h=>{const g=(window as any).__game,c=g.missionForProfiling().vehicles.entity(h).car.body.rotation();
  // The car's front in renderer axes, and CJ's heading against it (anticlockwise seen from above is positive).
  // The player's heading grows anticlockwise (forward (sin h, cos h) in renderer x and z), so his left is front + 90.
  const x=2*(c.x*c.z+c.w*c.y)*-1,z=-(1-2*(c.x*c.x+c.y*c.y));const front=Math.atan2(x,z),d=g.state().player.heading-front;return Math.atan2(Math.sin(d),Math.cos(d))*180/Math.PI;},car);
 await expect.poll(facing,{timeout:5000}).toBeGreaterThan(79);
 expect(await facing()).toBeLessThan(101);
 await w('detachPedFromCar',1);
 expect(await w('isCharAttachedToAnyCar',1)).toBe(false);
 const back=await page.evaluate(()=>{const inv=(window as any).__game.weapons().inventory,a=inv.ammo.get(22),ak=inv.ammo.get(30);return {selected:inv.selected,pistol:a.clip+a.reserve,ak:ak.clip+ak.reserve};});
 expect(back).toEqual({selected:22,pistol,ak:0});
 // Detaching a player who hangs from nothing does nothing.
 await w('detachPedFromCar',1);
 expect(errors).toEqual([]);
});
