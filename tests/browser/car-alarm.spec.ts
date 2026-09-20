import {test,expect} from '@playwright/test';

test('an armed alarm goes off for 15 s when another car hits the parked car',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{WorldFleet},{Simulation},{loadWorldRoadMaterials},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldFleet.ts','/src/simulation/Simulation.ts','/src/assets/worldRoadMaterials.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(300,.5,300).setTranslation(2490,12,1680));sim.respawn={x:2495,y:12.55,z:1687};sim.resetPlayer();sim.world.step();
  const fleet=new WorldFleet(sim,scene,await loadWorldRoadMaterials(base),undefined,base) as any;
  try{
   for(let i=0;i<300&&!fleet.catalog;i++){fleet.update(i*100);await new Promise(r=>setTimeout(r,20));}
   const parked=await fleet.spawnTrafficCar(492,{x:2500,y:12.5,z:1700},0),ram=await fleet.spawnTrafficCar(492,{x:2500,y:12.5,z:1712},0);
   parked.alarmArmed=true;
   const tick=()=>{for(const c of fleet.cars)c.beforeStep(1/60,{x:0,y:0},false);sim.world.step();for(const c of fleet.cars)c.afterStep(1/60);};
   for(let i=0;i<30;i++)tick();
   const before={alarm:parked.alarm,armed:parked.alarmArmed};
   // Drive the second car into the parked one at 12 m/s (its brakes would otherwise stop it short).
   let hitAt=-1;for(let i=0;i<180;i++){if(hitAt<0)ram.car.body.setLinvel({x:0,y:0,z:-12},true);tick();if(parked.alarm>0&&hitAt<0)hitAt=i;}
   const after={alarm:parked.alarm,armed:parked.alarmArmed,ramAlarm:ram.alarm,hitAt};
   return {before,after};
  }finally{fleet.dispose();sim.dispose();}
 });
 expect(result.before).toEqual({alarm:0,armed:true});
 expect(result.after.hitAt).toBeGreaterThanOrEqual(0);
 expect(result.after.armed).toBe(false);
 // Set off at 15 s and counting down since the hit.
 expect(result.after.alarm).toBeGreaterThan(15-(180-result.after.hitAt)/60-0.1);
 expect(result.after.alarm).toBeLessThanOrEqual(15);
 expect(result.after.ramAlarm).toBe(0);
});
