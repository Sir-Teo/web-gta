import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('delayed motorbike, boat and helicopter blasts keep their player or non-player creator',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const base=await page.evaluate(()=>{
  const g=(window as any).__game,w=g.missionForProfiling().runtime.world,p=w.pedPosition(1),base={x:p.x,y:p.y,z:p.z+20};w.setPedCoordinates(1,base.x,base.y,base.z);w.freezePedPosition(1,true);
  const win=window as any;win.__delayedTrace=[];win.__delayedPrior=g.weapons().onExplosion;g.weapons().onExplosion=(position:any,params:any,byPlayer:boolean)=>{win.__delayedTrace.push({position:{...position},byPlayer});win.__delayedPrior?.(position,params,byPlayer);};return base;
 });
 const results:any[]=[];
 for(const model of[461,454,487])for(const byPlayer of[false,true]){
  const h=await page.evaluate(({model,base})=>(window as any).__game.missionForProfiling().vehicles.create(model,{x:base.x+15,y:base.y,z:base.z+1},0),{model,base});
  await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),h,{timeout:60000});
  await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.freezeVehiclePosition(h,true),h);await page.waitForTimeout(600);
  const armed=await page.evaluate(({h,byPlayer})=>{
   const g=(window as any).__game,v=g.missionForProfiling().vehicles.entity(h);if(!v.car.body.isEnabled())throw new Error('Fixture vehicle collision is disabled');(window as any).__delayedTrace=[];
   // Inject a controlled creator-tagged blast into the real damage path; the normal main loop owns timer expiry.
   g.weapons().explode(v.car.body.translation(),2,undefined,byPlayer);return{health:v.health,timer:v.bombTimerMs,creator:v.bombDetonatedByPlayer};
  },{h,byPlayer});
  expect(armed.health).toBe(0);expect(armed.timer).toBeGreaterThanOrEqual(1000);expect(armed.timer).toBeLessThanOrEqual(3047);expect(armed.creator).toBe(byPlayer);
  await expect.poll(()=>page.evaluate(()=>(window as any).__delayedTrace.length),{timeout:12000,message:`model ${model} emits its delayed blast`}).toBeGreaterThan(1);
  const result=await page.evaluate(h=>{const g=(window as any).__game,v=g.missionForProfiling().vehicles.entity(h);return{timer:v.bombTimerMs,creator:v.explosionByPlayer,trace:(window as any).__delayedTrace};},h);
  expect(result.timer).toBe(0);expect(result.creator).toBe(byPlayer);expect(result.trace.every((e:any)=>e.byPlayer===byPlayer)).toBe(true);results.push({model,byPlayer,armed,...result});
  await page.evaluate(h=>(window as any).__game.missionForProfiling().vehicles.delete(h),h);
 }
 await page.evaluate(()=>{const g=(window as any).__game;g.weapons().onExplosion=(window as any).__delayedPrior;g.missionForProfiling().runtime.world.freezePedPosition(1,false);});writeFileSync('artifacts/delayed-vehicle-blast.json',JSON.stringify(results,null,2));expect(errors).toEqual([]);
});
