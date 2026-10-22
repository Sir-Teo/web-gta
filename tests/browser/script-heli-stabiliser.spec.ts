import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('SET_HELI_STABILISER changes the remote Goblin flight response and can be cleared',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const handle=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling(),p=m.runtime.world.pedPosition(1);return m.vehicles.create(501,{x:p.x+20,y:p.y,z:p.z+30});});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),handle,{timeout:60000});
 await page.evaluate(h=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.takeRemoteControlOfCar(0,h);w.setHeliBladesFullSpeed(h);w.setPlayerControl(0,true);},handle);
 await page.waitForFunction(h=>(window as any).__game.missionForProfiling().vehicles.entity(h)?.remoteControlled,handle);
 const result=await page.evaluate(h=>{
  const m=(window as any).__game.missionForProfiling(),v=m.vehicles.entity(h),w=m.runtime.world;
  // Compare the same physical state inside one browser task, before the solver or the next frame can alter it.
  const sample=(enabled:boolean)=>{
   v.body.setRotation({x:0,y:0,z:0,w:1},true);v.body.setLinvel({x:0,y:0,z:0},true);v.body.setAngvel({x:0,y:0,z:0},true);
   w.setHeliStabiliser(h,enabled);v.beforeStep(1/60,{throttle:0,pitch:1,roll:1,rudder:.5,brake:false});
   return {spin:{...v.body.angvel()},flag:v.heliMinimumTilt};
  };
  const normal=sample(false),stable=sample(true),restored=sample(false),f=v.assets.flyingHandling.values;
  return {normal,stable,restored,scale:Math.sin(.25*Math.asin(f.pitch/f.attackLift))*f.attackLift/f.pitch,occupied:v.occupied};
 },handle);
 expect(result.normal.flag).toBe(false);expect(result.stable.flag).toBe(true);expect(result.restored.flag).toBe(false);expect(result.occupied).toBe(false);
 expect(Math.abs(result.normal.spin.x)).toBeGreaterThan(.01);expect(Math.abs(result.normal.spin.z)).toBeGreaterThan(.01);
 // The common resistance tail is nonlinear in angular speed, so the final ratio differs slightly from the input scale.
 expect(result.stable.spin.x/result.normal.spin.x).toBeCloseTo(result.scale,4);expect(result.stable.spin.z/result.normal.spin.z).toBeCloseTo(result.scale,4);
 expect(result.stable.spin.y).toBeCloseTo(result.normal.spin.y,6);expect(result.restored.spin).toEqual(result.normal.spin);
 expect(errors).toEqual([]);
});
