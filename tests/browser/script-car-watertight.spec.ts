import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CAutomobile::ProcessPedInVehicleBuoyancy: a script ped sat in a car that has gone under drowns (WEAPON_DROWNING a
 * health point a 50th of a second), unless SET_CAR_WATERTIGHT (-159, STEAL5, DSKOOL) made the car watertight. */
test('a script ped in a sunk car drowns unless the car is watertight',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 // On Santa Maria pier, over the sea.
 await w('setPedCoordinates',1,836,-1856,-100);
 await page.waitForFunction(()=>{const st=(window as any).__game.state();return !st.terrainHold&&st.player.grounded;},undefined,{timeout:120000});
 expect(await w('waterHeightAtCoords',850,-1900,false)).toBeCloseTo(0,0);
 const made=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling();
  return {open:m.vehicles.create(400,{x:846,y:-1900,z:2},0),tight:m.vehicles.create(400,{x:856,y:-1900,z:2},0),a:m.peds.create(4,'MALE01',{x:840,y:-1860,z:13}),b:m.peds.create(4,'MALE01',{x:842,y:-1860,z:13})};});
 await page.waitForFunction(m=>{const g=(window as any).__game.missionForProfiling();return !!g.vehicles.entity(m.open)&&!!g.vehicles.entity(m.tight)&&!!g.peds.entity(m.a)&&!!g.peds.entity(m.b);},made,{timeout:60000});
 await w('warpPedIntoCar',made.a,made.open);await w('warpPedIntoCar',made.b,made.tight);
 await w('setVehicleWatertight',made.tight,true);
 await expect.poll(()=>page.evaluate(m=>{const g=(window as any).__game.missionForProfiling();return g.vehicles.entity(m.open).drowning&&g.vehicles.entity(m.tight).drowning;},made),{timeout:60000}).toBe(true);
 await expect.poll(()=>w('pedHealth',made.a),{timeout:30000}).toBeLessThan(60);
 expect(await w('pedHealth',made.b)).toBe(100);
 // IS_CAR_DEAD: a drowning car is dead to the script (bIsDrowning), watertight or not.
 expect([await w('vehicleIsDeadForScript',made.open),await w('vehicleIsDeadForScript',made.tight)]).toEqual([true,true]);
 expect(errors).toEqual([]);
});
