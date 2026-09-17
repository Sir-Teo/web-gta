import {test,expect} from '@playwright/test';

test('the fleet parks one bike on flat ground near the player',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{loadWorldRoadMaterials},{WorldFleet},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/worldRoadMaterials.ts','/src/simulation/WorldFleet.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href;
  const sim=new Simulation(),scene=new THREE.Scene();
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(0,-.5,0));
  sim.respawn={x:0,y:.55,z:0};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const fleet=new WorldFleet(sim,scene,await loadWorldRoadMaterials(base),undefined,base);
  const out:Record<string,unknown>={};
  try{
   const spot=fleet.bikeGroundSpot();
   out.spot=spot?{r:Math.hypot(spot.x,spot.z)}:null;
   const bike=spot?await fleet.spawnBike(481,spot.x,spot.z,0):undefined;
   out.spawned=!!bike;
   for(let i=0;i<60;i++){bike?.beforeStep(1/60);sim.world.step();bike?.afterStep();}
   out.settled=bike?bike.body.translation().y:null;
   out.nearest=fleet.nearestBike()===bike;
   out.unoccupied=!fleet.occupiedBike;
   fleet.update(Date.now());
   out.kept=fleet.bikes.size;
   out.snapshot=fleet.snapshot().bikes.map((b:any)=>b.modelId);
   return out;
  }finally{fleet.dispose();sim.dispose();}
 });
 expect((result.spot as {r:number}|null)?.r).toBeGreaterThan(10);
 expect((result.spot as {r:number}|null)?.r).toBeLessThan(32);
 expect(result.spawned).toBe(true);
 expect(result.settled).toBeGreaterThan(0);
 expect(result.settled).toBeLessThan(1);
 expect(result.nearest).toBe(true);
 expect(result.unoccupied).toBe(true);
 expect(result.kept).toBe(1);
 expect(result.snapshot).toEqual([481]);
 expect(errors).toEqual([]);
});
