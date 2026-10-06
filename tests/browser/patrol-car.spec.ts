import {test,expect} from '@playwright/test';

test('the popcycle cop share puts a cruising patrol car in traffic that joins the pursuit once wanted',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{WorldTraffic},{WorldFleet},{WorldPolice},{WantedSystem},{VehicleAnimationLibrary},{Simulation},{loadWorldRoadMaterials},{copCarShare},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldTraffic.ts','/src/simulation/WorldFleet.ts','/src/simulation/WorldPolice.ts','/src/simulation/WantedSystem.ts','/src/assets/vehicleAnimations.ts','/src/simulation/Simulation.ts','/src/assets/worldRoadMaterials.ts','/src/assets/populationCycle.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(700,.5,700).setTranslation(2490,12,1680));sim.respawn={x:2495,y:12.55,z:1687};sim.resetPlayer();sim.world.step();
  const fleet=new WorldFleet(sim,scene,await loadWorldRoadMaterials(base),undefined,base) as any,traffic=new WorldTraffic(sim,fleet,base) as any;
  const law=new WantedSystem(),clips=new VehicleAnimationLibrary(base),police=new WorldPolice(sim,fleet,law,clips,base) as any;
  traffic.spawnPatrol=(position:any,heading:number)=>police.spawnPatrol(position,heading);
  try{
   for(let i=0;i<300&&!fleet.catalog;i++){fleet.update(i*100);await new Promise(r=>setTimeout(r,20));}
   if(!fleet.catalog)throw new Error('fleet catalog did not load');
   // A rich residential zone at 12:00 with no gangs: cops take a tenth of the population, the row's cop column of the cars.
   sim.timeMinutes=12*60;const zeros=Array(10).fill(0);
   fleet.currentZone={infoLabel:'RICH',textLabel:'RICH',zoneInfoIndex:0,level:1,populationType:4,gangStrength:zeros,dealerStrength:0,noCops:false};
   const share=copCarShare(fleet.popRow(),4,zeros,0);
   const draws=Array.from({length:600},()=>fleet.patrolCarDue()).filter(Boolean).length;
   fleet.currentZone.noCops=true;const noCops=Array.from({length:200},()=>fleet.patrolCarDue()).some(Boolean);
   fleet.currentZone.noCops=false;
   // Force the draw so the spawn path is exercised deterministically.
   fleet.patrolCarDue=()=>true;
   for(let i=0;i<300&&!police.units.length;i++){traffic.update(i*2100);await new Promise(r=>setTimeout(r,20));}
   const unit=police.units[0];if(!unit)throw new Error(JSON.stringify({traffic:traffic.snapshot(),police:police.snapshot()}));
   const spawned={modelId:unit.car.modelId,mission:unit.mission,siren:unit.siren,cruise:unit.cruise,seats:unit.seats.filter(Boolean).length,trafficDrivers:traffic.snapshot().cars.length};
   const tick=()=>{const at=unit.car.car.body.translation();sim.player.position={x:at.x+8,y:at.y,z:at.z+8};traffic.beforeStep(1/60);police.beforeStep(1/60);for(const c of fleet.cars)c.beforeStep(1/60,{x:0,y:0},false);sim.world.step();for(const c of fleet.cars)c.afterStep();};
   // A cruising patrol waits on its brakes until it is joined to a road link, which needs the paths around it loaded
   // (the game's own load is not awaited between these hand-driven ticks).
   {const at=unit.car.car.body.translation();await police.paths.loadAround(at.x,at.z);}
   for(let i=0;i<240;i++)tick();
   const start=unit.car.car.body.translation();for(let i=0;i<240;i++)tick();const end=unit.car.car.body.translation();
   const cruised={mission:unit.mission,siren:unit.siren,moved:Math.hypot(end.x-start.x,end.z-start.z)};
   law.setLevel(1);for(let i=0;i<60;i++)tick();
   const pursuit={mission:unit.mission,wantedNow:law.level};
   return {share,draws,noCops,spawned,cruised,pursuit};
  }finally{traffic.dispose();police.dispose();fleet.dispose();sim.dispose();}
 });
 expect(result.share).toBeGreaterThan(0);
 expect(Math.abs(result.draws-result.share*600)).toBeLessThan(60);
 expect(result.noCops).toBe(false);
 expect(result.spawned.modelId).toBe(596);
 expect(result.spawned.mission).toBe('cruise');
 expect(result.spawned.siren).toBe(false);
 expect(result.spawned.cruise).toBeGreaterThanOrEqual(12);
 expect(result.spawned.seats).toBeGreaterThanOrEqual(1);
 // The patrol car belongs to the police system, not the traffic driver list.
 expect(result.spawned.trafficDrivers).toBe(0);
 expect(result.cruised.mission).toBe('cruise');
 expect(result.cruised.moved).toBeGreaterThan(3);
 expect(result.pursuit.mission).not.toBe('cruise');
});
