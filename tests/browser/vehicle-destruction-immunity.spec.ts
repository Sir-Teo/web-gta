import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('armed bike, boat and helicopter timers respect immunity and destroy healed vehicles when damage is restored',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const base=await page.evaluate(async()=>{
  const g=(window as any).__game,m=g.missionForProfiling(),w=m.runtime.world,p=w.pedPosition(1),base={x:p.x,y:p.y,z:p.z+20},path='/src/engine/scmOpcodes.ts',{scmOpcode}=await import(/* @vite-ignore */ path),op=scmOpcode('SET_ALL_CARS_CAN_BE_DAMAGED'),win=window as any;
  w.setPedCoordinates(1,base.x,base.y,base.z);w.freezePedPosition(1,true);win.__immunityTrace=[];win.__immunityPrior=g.weapons().onExplosion;g.weapons().onExplosion=(position:any,params:any,byPlayer:boolean)=>{win.__immunityTrace.push({position:{...position},byPlayer});win.__immunityPrior?.(position,params,byPlayer);};
  win.__immunityToggle=(enabled:boolean)=>{const code=new Uint8Array([op&255,op>>8,4,enabled?1:0,78,0]),slot=m.runtime.start(0,[],{space:code});slot.thread.usesMissionCleanup=false;slot.thread.run(g.gameTimeMs(),20,1);};return base;
 });
 const results:any[]=[];
 for(const model of[461,454,487])for(const protection of['global','individual','restored']as const){
  const protectedNow=protection!=='restored';
  const h=await page.evaluate(({model,base})=>(window as any).__game.missionForProfiling().vehicles.create(model,{x:base.x+15,y:base.y,z:base.z+1},0),{model,base});
  await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),h,{timeout:60000});await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.freezeVehiclePosition(h,true),h);await page.waitForTimeout(600);
  const setup=await page.evaluate(({h,protectedNow,protection})=>{const g=(window as any).__game,v=g.missionForProfiling().vehicles.entity(h),win=window as any;if(!v.car.body.isEnabled())throw new Error('Fixture collision is disabled');win.__immunityTrace=[];g.weapons().explode(v.car.body.translation(),2,undefined,true);const armed=v.bombTimerMs;if(protection==='individual')g.missionForProfiling().runtime.world.setVehicleCanBeDamaged(h,false);else win.__immunityToggle(false);if(!protectedNow)win.__immunityToggle(true);return{armed,health:v.health,canBeDamaged:v.canBeDamaged};},{h,protectedNow,protection});
  expect(setup.armed).toBeGreaterThanOrEqual(1000);expect(setup.health).toBe(protection==='individual'?0:300);expect(setup.canBeDamaged).toBe(!protectedNow);
  await expect.poll(()=>page.evaluate(h=>(window as any).__game.missionForProfiling().vehicles.entity(h).bombTimerMs,h),{timeout:12000}).toBe(0);
  const result=await page.evaluate(h=>{const v=(window as any).__game.missionForProfiling().vehicles.entity(h);return{health:v.health,wrecked:v.wrecked,trace:(window as any).__immunityTrace};},h);
  expect(result.health).toBe(protection==='global'?300:0);expect(result.wrecked).toBe(!protectedNow);if(protectedNow)expect(result.trace.length).toBe(1);else expect(result.trace.length).toBeGreaterThanOrEqual(2);expect(result.trace.every((e:any)=>e.byPlayer)).toBe(true);
  await page.evaluate(()=>(window as any).__immunityToggle(true));
  if(protectedNow){await page.waitForTimeout(400);expect(await page.evaluate(()=>(window as any).__immunityTrace.length)).toBe(1);}
  results.push({model,protection,protectedNow,setup,...result});await page.evaluate(h=>(window as any).__game.missionForProfiling().vehicles.delete(h),h);
 }
 await page.evaluate(()=>{const g=(window as any).__game;g.weapons().onExplosion=(window as any).__immunityPrior;g.missionForProfiling().runtime.world.freezePedPosition(1,false);});writeFileSync('artifacts/vehicle-destruction-immunity.json',JSON.stringify(results,null,2));expect(errors).toEqual([]);
});
