import {test,expect} from '@playwright/test';

// CAutomobile::ProcessOpenDoor: a bonnet torn off at speed flies as a type 2 component at 0.4 of the car's speed
// plus a tenth of a unit a frame to the right, and half a unit a frame up or down.
test('a torn-off bonnet flies off to the right at 0.4 of the car\'s speed',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{WorldFleet},{Simulation},{loadWorldRoadMaterials},{DAMSTATE},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldFleet.ts','/src/simulation/Simulation.ts','/src/assets/worldRoadMaterials.ts','/src/simulation/nativeCarDamage.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(300,.5,300).setTranslation(2490,12,1680));sim.respawn={x:2495,y:12.55,z:1687};sim.resetPlayer();sim.world.step();
  const fleet=new WorldFleet(sim,scene,await loadWorldRoadMaterials(base),undefined,base) as any;
  try{
   for(let i=0;i<300&&!fleet.catalog;i++){fleet.update(i*100);await new Promise(r=>setTimeout(r,20));}
   const car=await fleet.spawnTrafficCar(492,{x:2500,y:12.5,z:1700},0);
   for(let i=0;i<30;i++){car.beforeStep(1/60,{x:0,y:0},false);sim.world.step();car.afterStep(1/60);}
   // Heading 0 faces -z; 25 m/s forward.
   car.car.body.setLinvel({x:0,y:0,z:-25},true);
   car.tearOffBonnet();
   const pieces=car.debris.snapshot().length,body=car.debris.items?.[0]?.body,v=body?.linvel();
   return {pieces,state:car.damageState.doors[0],notPresent:DAMSTATE.notPresent,v:v&&{x:v.x,y:v.y,z:v.z}};
  }finally{fleet.dispose();sim.dispose();}
 });
 expect(result.pieces).toBe(1);
 expect(result.state).toBe(result.notPresent);
 // 0.4 x 25 m/s forward, 5 m/s to the right (+x), and 25 m/s up or down.
 expect(result.v!.z).toBeCloseTo(-10,0);
 expect(result.v!.x).toBeCloseTo(5,0);
 expect(Math.abs(result.v!.y)).toBeCloseTo(25,0);
});
