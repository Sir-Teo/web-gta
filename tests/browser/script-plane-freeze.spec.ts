import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** FREEZE_CAR_POSITION on a plane (HEIST2 freezes its Nevada while it sets it 750 units up for the jump): bIsFrozen
 * keeps the body off, whatever the plane's own step would make of it, until the script lets it go. */
test('a frozen script plane holds where it is put and falls once let go',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 const plane=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().vehicles.create(593,{x:p.x+12,y:-p.z,z:-100},0);});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),plane,{timeout:60000});
 const body=()=>page.evaluate(h=>{const b=(window as any).__game.missionForProfiling().vehicles.entity(h).car.body;const t=b.translation();return {on:b.isEnabled(),y:+t.y.toFixed(2)};},plane);
 await page.waitForTimeout(1500);const before=await body();
 await page.evaluate(h=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.freezeVehiclePosition(h,true);},plane);
 await page.evaluate(h=>{const m=(window as any).__game.missionForProfiling();const e=m.vehicles.entity(h);const t=e.car.body.translation();e.car.body.setTranslation({x:t.x,y:t.y+20,z:t.z},true);},plane);
 await page.waitForTimeout(1500);const frozen=await body();
 await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.freezeVehiclePosition(h,false),plane);
 await page.waitForTimeout(3000);const after=await body();
 expect(frozen.on).toBe(false);expect(frozen.y).toBeGreaterThan(before.y+19);expect(after.y).toBeLessThan(frozen.y-5);
 expect(errors).toEqual([]);
});
