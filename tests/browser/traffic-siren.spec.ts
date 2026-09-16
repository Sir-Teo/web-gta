import {test,expect} from '@playwright/test';

test('traffic pulls over and holds for a sounding siren',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldTraffic},{WorldFleet},{Simulation},{loadWorldRoadMaterials},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldTraffic.ts','/src/simulation/WorldFleet.ts','/src/simulation/Simulation.ts','/src/assets/worldRoadMaterials.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));sim.respawn={x:2495,y:12.55,z:1687};sim.resetPlayer();sim.world.step();
  const fleet=new WorldFleet(sim,scene,await loadWorldRoadMaterials(base),undefined,base),traffic=new WorldTraffic(sim,fleet,base);
  try{
   for(let i=0;i<300&&!traffic.snapshot().cars.length;i++){traffic.update(i*2100);await new Promise(r=>setTimeout(r,20));}
   if(!fleet.cars.size)throw new Error(JSON.stringify(traffic.snapshot()));
   const car=[...fleet.cars][0] as any;
   const tick=()=>{traffic.beforeStep(1/60);for(const c of fleet.cars)c.beforeStep(1/60,{x:0,y:0},false);sim.world.step();for(const c of fleet.cars)c.afterStep();};
   for(let i=0;i<120;i++)tick();
   const rolling=traffic.snapshot().cars[0].speed;
   // Park a sounding siren on the driver's bumper.
   let siren:{x:number;z:number}|undefined={...car.car.body.translation()};
   traffic.sirens=()=>[siren!].filter(Boolean) as {x:number;z:number}[];
   for(let i=0;i<240;i++){const p=car.car.body.translation();siren={x:p.x,z:p.z};tick();}
   const yielded=traffic.snapshot().cars[0];
   siren=undefined;for(let i=0;i<240;i++)tick();
   const resumed=traffic.snapshot().cars[0];
   return {rolling,stopped:yielded.stopped,yieldedSpeed:yielded.speed,resumedStopped:resumed.stopped,resumedSpeed:resumed.speed};
  }finally{traffic.dispose();fleet.dispose();if(scene.children.length)throw new Error('Traffic views leaked');sim.dispose();}
 });
 expect(result.rolling).toBeGreaterThan(1);
 expect(result.stopped).toBe('siren');
 expect(result.yieldedSpeed).toBeLessThan(1);
 expect(result.resumedSpeed).toBeGreaterThan(result.yieldedSpeed);
});
