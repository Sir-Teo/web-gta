import {test,expect} from '@playwright/test';

test('native cars and aircraft drain driver breath only while drowning',async({page})=>{
 await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldCar},{loadWorldRoadMaterials},{WorldCar},{WorldPlane},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldCar.ts','/src/assets/worldRoadMaterials.ts','/src/simulation/WorldCar.ts','/src/simulation/WorldPlane.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();
  const base=new URL('/play/world/',location.href).href,catalog=await openStaticWorldVehicles(await openStaticWorld(base)),road=await loadWorldRoadMaterials(base);
  const results=[];
  for(const kind of ['car','plane']){
   const sim=new Simulation(),scene=new THREE.Scene();sim.world.timestep=1/50;
   const vehicle=kind==='car'?new WorldCar(sim,scene,await loadFixedWorldCar(catalog,{modelId:492,primaryColor:53,secondaryColor:0}),{x:0,y:0,z:0},road):new WorldPlane(sim,scene,await catalog.load(487),{x:0,y:0,z:0});
   const body=kind==='car'?vehicle.car.body:vehicle.body;
   const step=()=>{sim.beginPlayerBreathFrame(1/50);if(kind==='car')vehicle.beforeStep(1/50,{x:0,y:0},false);else vehicle.beforeStep(1/50,{throttle:0,pitch:0,roll:0,rudder:0,brake:false});};
   try{
    if(kind==='car')vehicle.setPedInAsDriver();else vehicle.finishEnter();
    vehicle.waterLevel=()=>2;
    sim.player.breath=10;sim.player.armour=100;
    // Keep the chassis pose fixed to isolate callback/rate from sinking dynamics.
    step();const first=sim.player.breath;
    step();const second=sim.player.breath;
    sim.player.breath=0;const health=sim.player.health;step();
    const drowned={health:sim.player.health,armour:sim.player.armour,flag:vehicle.drowning};
    vehicle.waterLevel=()=>undefined;
    step();const leaving=sim.player.breath;
    step();const recovered=sim.player.breath;
    results.push({kind,first,second,health,drowned,leaving,recovered,bodyEnabled:body.isEnabled()});
   }finally{vehicle.dispose();sim.dispose();}
  }
  return results;
 });
 for(const r of result){
  expect(r.drowned.flag,r.kind).toBe(true);
  expect(r.first,r.kind).toBe(9);expect(r.second,r.kind).toBe(8);
  expect(r.drowned.health,r.kind).toBeLessThan(r.health);expect(r.drowned.armour).toBe(100);
  expect(r.leaving,r.kind).toBe(0);expect(r.recovered,r.kind).toBe(2);
  expect(r.bodyEnabled).toBe(true);
 }
});

test('an overturned stationary boat drains breath; an upright boat does not',async({page})=>{
 await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{WorldBoat},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/simulation/WorldBoat.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href,catalog=await openStaticWorldVehicles(await openStaticWorld(base));
  const sim=new Simulation(),scene=new THREE.Scene(),boat=new WorldBoat(sim,scene,await catalog.load(473),{x:0,y:0,z:0});
  try{
   boat.waterLevel=()=>2;boat.finishEnter();sim.player.breath=10;
   sim.beginPlayerBreathFrame(1/50);boat.beforeStep(1/50);const upright=sim.player.breath;
   boat.body.setRotation({x:1,y:0,z:0,w:0},true);boat.body.setLinvel({x:0,y:0,z:0},true);
   // Previous dry frame permits recovery once before this frame's drowning callback.
   sim.beginPlayerBreathFrame(1/50);boat.beforeStep(1/50);const inverted=sim.player.breath;
   sim.beginPlayerBreathFrame(1/50);boat.beforeStep(1/50);const continuing=sim.player.breath;
   return {upright,inverted,continuing};
  }finally{boat.dispose();sim.dispose();}
 });
 expect(result).toEqual({upright:10,inverted:11,continuing:10});
});
