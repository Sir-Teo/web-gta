import {test,expect} from '@playwright/test';

test('CJ can start getting into a car whose engine is burning (no CFire on it)',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{WorldTraffic},{WorldFleet},{CarEntry},{VehicleAnimationLibrary},{Simulation},{loadWorldRoadMaterials},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldTraffic.ts','/src/simulation/WorldFleet.ts','/src/simulation/CarEntry.ts','/src/assets/vehicleAnimations.ts','/src/simulation/Simulation.ts','/src/assets/worldRoadMaterials.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(700,.5,700).setTranslation(2490,12,1680));sim.respawn={x:2495,y:12.55,z:1687};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const fleet=new WorldFleet(sim,scene,await loadWorldRoadMaterials(base),undefined,base),traffic=new WorldTraffic(sim,fleet,base),entry=new CarEntry(sim,new VehicleAnimationLibrary(base));
  try{
   for(let i=0;i<300&&!traffic.snapshot().cars.length;i++){traffic.update(i*2100);await new Promise(r=>setTimeout(r,20));}
   const car=[...fleet.cars][0] as any;if(!car)throw new Error('no car');
   car.health=200;
   return {onFire:car.onFire,entered:entry.enter(car),active:entry.active};
  }finally{entry.dispose?.();traffic.dispose();fleet.dispose();sim.dispose();}
 });
 expect(result).toEqual({onFire:true,entered:true,active:true});
});
