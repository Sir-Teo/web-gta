import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CTaskComplexEnterCar::CreateFirstSubTask: a ped already in the car it is told to enter sits on in its seat and the
 * task is over (CTaskSimpleCarDriveTimed). SWEET3 makes Smoke and Ryder in Sweet's Greenwood and then tells each to
 * enter it in the other's seat: they stay where they were made, rather than getting out (Smoke was left behind). */
test('a ped told to enter the car it already rides keeps its seat',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().vehicles.create(492,{x:p.x+10,y:-p.z,z:-100},0);});
 await page.waitForFunction(c=>!!(window as any).__game.missionForProfiling().vehicles.entity(c),car,{timeout:60000});
 const [rear,right]=await page.evaluate(c=>{const m=(window as any).__game.missionForProfiling();return [m.peds.createInCar(24,'MALE01',c,2),m.peds.createInCar(24,'MALE01',c,1)];},car);
 await page.waitForFunction(([a,b])=>{const m=(window as any).__game.missionForProfiling();return !!m.peds.entity(a)&&!!m.peds.entity(b);},[rear,right],{timeout:60000});
 await w('givePedScriptedTask',rear,{kind:'enterCarAsPassenger',vehicle:car,time:10000,seat:1},0x05ca);
 await w('givePedScriptedTask',right,{kind:'enterCarAsPassenger',vehicle:car,time:10000,seat:2},0x05ca);
 await page.waitForTimeout(3000);
 expect(await w('pedVehicle',rear)).toBe(car);expect(await w('pedVehicle',right)).toBe(car);
 // The task is over at once.
 expect(await w('scriptTaskStatus',rear,0x05ca)).toBe(7);
 expect(errors).toEqual([]);
});
