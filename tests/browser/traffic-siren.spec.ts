import {test,expect} from '@playwright/test';

test('a car ahead of a sounding siren swerves and stops, then drives on',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldTraffic},{WorldFleet},{Simulation},{loadWorldRoadMaterials},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldTraffic.ts','/src/simulation/WorldFleet.ts','/src/simulation/Simulation.ts','/src/assets/worldRoadMaterials.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(700,.5,700).setTranslation(2490,12,1680));sim.respawn={x:2495,y:12.55,z:1687};sim.resetPlayer();sim.world.step();
  const fleet=new WorldFleet(sim,scene,await loadWorldRoadMaterials(base),undefined,base),traffic=new WorldTraffic(sim,fleet,base);
  try{
   for(let i=0;i<300&&!traffic.snapshot().cars.length;i++){traffic.update(i*2100);await new Promise(r=>setTimeout(r,20));}
   if(!fleet.cars.size)throw new Error(JSON.stringify(traffic.snapshot()));
   const car=[...fleet.cars][0] as any;
   const tick=()=>{const at=car.car.body.translation();sim.player.position={x:at.x+10,y:at.y,z:at.z+10};traffic.beforeStep(1/60);for(const c of fleet.cars)c.beforeStep(1/60,{x:0,y:0},false);sim.world.step();for(const c of fleet.cars)c.afterStep();};
   // MakeWayForCarWithSiren only moves cars faster than √0.05 units per frame (11.2 m/s): cruise at 20 CarAI units.
   (traffic as any).drivers[0].cruiseSpeed=20;
   for(let i=0;i<300;i++)tick();
   const rolling=traffic.snapshot().cars[0].speed;
   // A siren 15 units behind, closing at 25 m/s along the car's heading.
   const sirenAt=()=>{const p=car.car.body.translation(),q=car.car.body.rotation(),heading=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.x*q.x+q.y*q.y)),f={x:-Math.sin(heading),z:-Math.cos(heading)};
    return {position:{x:p.x-f.x*15,y:p.y,z:p.z-f.z*15},velocity:{x:f.x*25,y:0,z:f.z*25}};};
   const siren=sirenAt();traffic.sirens=()=>[siren];tick();traffic.sirens=()=>[];
   const yielding=traffic.snapshot().cars[0];
   for(let i=0;i<160;i++)tick();const swerved=traffic.snapshot().cars[0];
   for(let i=0;i<170;i++)tick();const held=traffic.snapshot().cars[0];
   for(let i=0;i<300;i++)tick();const resumed=traffic.snapshot().cars[0];
   return {rolling,yielding:yielding.temp,stopped:yielding.stopped,afterSwerve:swerved.temp,heldTemp:held.temp,heldSpeed:held.speed,resumedTemp:resumed.temp,resumedSpeed:resumed.speed};
  }finally{traffic.dispose();fleet.dispose();if(scene.children.length)throw new Error('Traffic views leaked');sim.dispose();}
 });
 expect(result.rolling).toBeGreaterThan(11.2);
 // TEMPACT_SWIRVELEFT_STOP for 2.5 s: swerve towards the kerb with no gas (and a 0.001 brake), then TEMPACT_WAIT
 // (brake 0.2) for 4 s, which brings it to a stop.
 expect(result.yielding).toBe('swerveStop');expect(result.stopped).toBe('siren');
 expect(result.afterSwerve).toBe('wait');expect(result.heldTemp).toBe('wait');
 expect(result.heldSpeed).toBeLessThan(result.rolling*.6);
 expect(result.resumedTemp).toBeNull();expect(result.resumedSpeed).toBeGreaterThan(result.heldSpeed);
});
