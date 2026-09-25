import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** FREEZE_CAR_POSITION(_AND_DONT_LOAD_COLLISION): a frozen car holds still where the script puts it. Unfreezing used to
 * turn Rapier's gravity on for the body, and the car's native forces then threw every frame (INTRO1 lets its bikes
 * and the Ballas' car go), stopping the whole simulation. A car let go at rest stays at rest: after ten static frames
 * CAutomobile::ProcessControl skips its physics until something moves it, in the air or not. */
test('a script car frozen and let go holds, and the frame keeps running',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().vehicles.create(596,{x:p.x+10,y:-p.z,z:-100},0);});
 await page.waitForFunction(c=>!!(window as any).__game.missionForProfiling().vehicles.entity(c),car,{timeout:60000});
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 const height=()=>page.evaluate(c=>(window as any).__game.missionForProfiling().vehicles.entity(c).car.body.translation().y,car);
 // Settled on the ground first, then frozen and put four units up (SET_CAR_COORDINATES moves a frozen car).
 await page.waitForTimeout(2500);
 await w('freezeVehiclePosition',car,true);
 const at=await w('vehiclePosition',car) as {x:number;y:number;z:number};
 await w('setVehicleCoordinates',car,at.x,at.y,at.z+4);
 await page.waitForTimeout(300);
 const held=await height();await page.waitForTimeout(1500);
 expect(Math.abs(await height()-held)).toBeLessThan(.01);
 await w('freezeVehiclePosition',car,false);
 // Let go, the body is back in the world and the frame runs on: the player walks.
 expect(await page.evaluate(c=>(window as any).__game.missionForProfiling().vehicles.entity(c).car.body.isEnabled(),car)).toBe(true);
 const start=await page.evaluate(()=>{const p=(window as any).__game.state().player.position;return {x:p.x,z:p.z};});
 await page.keyboard.down('KeyW');
 await expect.poll(()=>page.evaluate(s=>{const p=(window as any).__game.state().player.position;return Math.hypot(p.x-s.x,p.z-s.z);},start),{timeout:20000}).toBeGreaterThan(1);
 await page.keyboard.up('KeyW');
 expect(errors).toEqual([]);
});
