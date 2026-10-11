import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** ATTACH_CHAR_TO_BIKE on the player (iOS 0x1001f2640, CPed::AttachPedToBike): SYN1 seats CJ with the camera on a
 * hidden, frozen mountain bike at its photo spot. The command was skipped, so CJ stood where he was, unarmed for the
 * photos the mission waits on. AttachPedToBike is AttachPedToEntity, as the car form. */
test('the player is set on a bike at an offset with the camera',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 const bike=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().vehicles.create(510,{x:p.x+6,y:-p.z,z:-100},0);});
 await page.waitForFunction((h:number)=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),bike,{timeout:60000});
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 // SYN1's own: FREEZE_CAR_POSITION, SET_CAR_VISIBLE 0, then the attachment at (-0.2, 0.5, 0), side 1, 110 and 70, the camera.
 await w('freezeVehiclePosition',bike,true);
 await w('attachPedToBike',1,bike,{x:-.2,y:.5,z:0},1,110*Math.PI/180,70*Math.PI/180,43);
 expect(await w('isCharAttachedToAnyCar',1)).toBe(true);
 expect(await page.evaluate(()=>(window as any).__game.weapons().inventory.selected)).toBe(43);
 const b=await w('vehiclePosition',bike) as {x:number;y:number;z:number},p=await w('pedPosition',1) as {x:number;y:number;z:number};
 expect(Math.hypot(p.x-(b.x-.2),p.y-(b.y+.5))).toBeLessThan(.3);
 expect(errors).toEqual([]);
});
