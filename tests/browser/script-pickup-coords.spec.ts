import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** IS_ANY_PICKUP_AT_COORDS (SYN7, HEIST9): CPickups::TestForPickupsInBubble half a unit round the point.
 * GET_DEAD_CHAR_PICKUP_COORDS (CAT1, SCRASH3, HEIST1): CPed::CreateDeadPedPickupCoors, a clear spot on the ground
 * 1.5 units round the dead ped and away from the player. */
test('a script finds a pickup at a point and a spot to drop one by a dead ped',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 const me=await w('pedPosition',1);
 const at={x:me.x+5,y:me.y,z:me.z};
 await page.evaluate(at=>(window as any).__game.missionForProfiling().runtime.game.pickups.createPickup(1240,3,at),at);
 await expect.poll(()=>w('anyPickupAtCoords',at.x,at.y,at.z),{timeout:20000}).toBe(true);
 expect(await w('anyPickupAtCoords',at.x+1,at.y,at.z)).toBe(false);
 // Execute WITH_AMMO through the VM: the sentinel asks the installed world's 2D ground query.
 const placed=await page.evaluate(me=>{
  const m=(window as any).__game.missionForProfiling(),x=Math.fround(me.x+8),y=Math.fround(me.y),ground=m.runtime.world.groundZForCoord(x,y),parts=[0x2b,3];
  const operand=(type:number,value:number)=>{const bytes=new Uint8Array(4),v=new DataView(bytes.buffer);if(type===6)v.setFloat32(0,value,true);else v.setInt32(0,value,true);parts.push(type,...bytes);};
  operand(1,1242);operand(1,3);operand(1,25);operand(6,x);operand(6,y);operand(6,-100);parts.push(3,0,0,78,0);
  const slot=m.runtime.start(0,[],{space:new Uint8Array(parts)});slot.thread.usesMissionCleanup=false;slot.thread.run(0,20);const handle=slot.thread.locals.getInt32(0,true),p=m.runtime.game.pickups.at(handle);
  return{ground,position:p.position,ammo:p.ammo};
 },me);
 expect(placed.position.z).toBeGreaterThan(-100);expect(Math.abs(placed.position.z-(placed.ground+.5))).toBeLessThan(.126);expect(placed.ammo).toBe(25);
 // A ped five units the other way, dead: the spot is 1.5 round it (flat on the plane), half a unit over the ground.
 const ped=await page.evaluate(me=>(window as any).__game.missionForProfiling().peds.create(4,'MALE01',{x:me.x-5,y:me.y,z:me.z}),me);
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),ped,{timeout:60000});
 await page.waitForTimeout(1000);
 await w('killPed',ped);
 await page.waitForTimeout(1500);
 const {body,spot}=await page.evaluate(h=>{const w=(window as any).__game.missionForProfiling().runtime.world;return{body:{...w.pedPosition(h)},spot:w.deadPedPickupCoordinates(h)};},ped);
 const flat=Math.hypot(spot.x-body.x,spot.y-body.y);
 expect(flat).toBeLessThan(1.6);
 const ground=await w('groundZFor3DCoord',spot.x,spot.y,spot.z+1);
 expect(Math.abs(spot.z-(ground+.5))<.2||flat<.01).toBe(true);
 expect(errors).toEqual([]);
});
