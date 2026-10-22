import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('a frozen burning boat still counts down to its explosion while its hull stays held',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const handle=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.sim.player.position;return m.vehicles.create(452,{x:p.x+30,y:-p.z,z:p.y+5},0);});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),handle,{timeout:60000});
 const held=await page.evaluate(h=>{const g=(window as any).__game,m=g.missionForProfiling();m.runtime.world.freezeVehiclePosition(h,true);m.runtime.world.setVehicleHealth(h,200);const boat=m.vehicles.entity(h);return {position:{...boat.body.translation()},start:g.gameTimeMs()};},handle);
 await page.waitForFunction(h=>(window as any).__game.missionForProfiling().vehicles.entity(h).burnTimer>.2,handle,{timeout:10000});
 await page.waitForFunction(h=>(window as any).__game.missionForProfiling().vehicles.entity(h).wrecked,handle,{timeout:15000});
 const result=await page.evaluate(h=>{const g=(window as any).__game,m=g.missionForProfiling(),boat=m.vehicles.entity(h);return {health:boat.health,frozen:boat.frozen,position:{...boat.body.translation()},enabled:boat.body.isEnabled(),scorched:boat.ambient.enabled.value,now:g.gameTimeMs(),skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};},handle);
 expect(result.health).toBe(0);expect(result.frozen).toBe(true);expect(result.enabled).toBe(true);expect(result.scorched).toBe(true);expect(result.now-held.start).toBeGreaterThan(4900);for(const axis of ['x','y','z'] as const)expect(result.position[axis]).toBeCloseTo(held.position[axis],4);expect(result.skipped).toEqual([]);expect(result.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
