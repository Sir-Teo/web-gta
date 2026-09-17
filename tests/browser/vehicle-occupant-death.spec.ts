import {test,expect} from '@playwright/test';

test('vehicle destruction kills its driver regardless of armour or damage scaling',async({page})=>{
 await page.goto('/models.html');
 const results=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldCar},{loadFixedWorldBike},{loadWorldRoadMaterials},{WorldCar},{WorldPlane},{WorldBoat},{WorldBike},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldCar.ts','/src/assets/fixedWorldBike.ts','/src/assets/worldRoadMaterials.ts','/src/simulation/WorldCar.ts','/src/simulation/WorldPlane.ts','/src/simulation/WorldBoat.ts','/src/simulation/WorldBike.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href,catalog=await openStaticWorldVehicles(await openStaticWorld(base)),road=await loadWorldRoadMaterials(base),results=[];
  for(const kind of ['car','plane','boat','bike']){
   const sim=new Simulation(),scene=new THREE.Scene(),position={x:0,y:0,z:0};
   const vehicle=kind==='car'?new WorldCar(sim,scene,await loadFixedWorldCar(catalog,{modelId:492,primaryColor:53,secondaryColor:0}),position,road):kind==='plane'?new WorldPlane(sim,scene,await catalog.load(487),position):kind==='boat'?new WorldBoat(sim,scene,await catalog.load(473),position):new WorldBike(sim,scene,await loadFixedWorldBike(catalog,{modelId:461,primaryColor:0,secondaryColor:0}),position);
   try{
    // Isolate the seated occupant event from entry animations and proximity.
    vehicle.occupied=true;sim.playerCollider.setEnabled(false);sim.player.health=75;sim.player.armour=100;
    const destroy=()=>kind==='plane'?vehicle.damage(10000):vehicle.blowUp();
    destroy();expectDestroyed();
    function expectDestroyed(){if(vehicle.health!==0)throw new Error(`${kind} fixture did not destroy the vehicle`);}
    const death={health:sim.player.health,armour:sim.player.armour,timer:sim.deathRemaining,occupied:vehicle.occupied};
    sim.advancePlayerDeath(1);const remaining=sim.deathRemaining;
    destroy(); // repeated destruction of the same wreck cannot restart death
    results.push({kind,death,remaining,afterRepeat:sim.deathRemaining});
   }finally{vehicle.dispose();sim.dispose();}
  }
  return results;
 });
 for(const r of results){
  expect(r.death.health,r.kind).toBe(0);expect(r.death.armour,r.kind).toBe(100);
  expect(r.death.timer,r.kind).toBeGreaterThan(0);expect(r.death.occupied,r.kind).toBe(false);
  expect(r.afterRepeat,r.kind).toBe(r.remaining);
 }
});
