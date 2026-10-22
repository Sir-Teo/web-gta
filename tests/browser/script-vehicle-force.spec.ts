import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';
test('the script force command lifts automobile, bicycle, motorcycle, boat and helicopter bodies',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const made=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.sim.player.position;m.runtime.world.setPlayerControl(0,false);return[596,481,461,454,487].map((model,index)=>({model,h:m.vehicles.create(model,{x:p.x+8+index*8,y:-p.z+20,z:p.y+10},0)}));});
 await page.waitForFunction(rows=>{const m=(window as any).__game.missionForProfiling();return rows.every(r=>m.vehicles.entity(r.h)?.car.body.isEnabled());},made,{timeout:90000});
 const result=await page.evaluate(rows=>{const g=(window as any).__game,m=g.missionForProfiling(),w=m.runtime.world;return rows.map(r=>{const v=m.vehicles.entity(r.h),body=v.car.body,before={...body.linvel()};w.applyForceToVehicle(r.h,{x:0,y:0,z:.1},{x:0,y:0,z:0});return{...r,before,after:{...body.linvel()},angular:{...body.angvel()},skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};});},made);
 writeFileSync('artifacts/script-vehicle-force.json',JSON.stringify({result,errors},null,2));for(const r of result){expect(r.after.y-r.before.y,`model ${r.model} gains native .1/frame`).toBeCloseTo(5,2);expect(r.after.x).toBeCloseTo(r.before.x,3);expect(r.after.z).toBeCloseTo(r.before.z,3);expect(r.skipped).toEqual([]);expect(r.gaveUp).toEqual([]);}expect(errors).toEqual([]);
});
