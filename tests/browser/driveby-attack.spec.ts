import {test,expect} from '@playwright/test';

test('a rival attack car cruises in with a posed drive-by crew',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{GangDriveBy},{WorldFleet},{Simulation},{loadWorldRoadMaterials},{VehicleOccupants},{THREE,RAPIER}]=await Promise.all(['/src/simulation/GangDriveBy.ts','/src/simulation/WorldFleet.ts','/src/simulation/Simulation.ts','/src/assets/worldRoadMaterials.ts','/src/render/VehicleOccupants.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const fleet=new WorldFleet(sim,scene,await loadWorldRoadMaterials(base),undefined,base);
   const driveby=new GangDriveBy(sim,fleet,base);
   const occupants=new VehicleOccupants(scene,base);
   driveby.gangTurf=()=>({gang:0,strength:255});
   let shots=0;driveby.onShot=()=>{shots++;};
  try{
   for(let i=0;i<300&&!driveby.snapshot().units.length;i++){driveby.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const tick=()=>{driveby.beforeStep(1/60);for(const c of fleet.cars)c.beforeStep(1/60,{x:0,y:0},false);sim.world.step();for(const c of fleet.cars)c.afterStep();occupants.update([...occupants.drivers(fleet.cars,(c:any)=>driveby.covers(c)),...driveby.poses()],[.7,.7,.7],0);};
   for(let i=0;i<30;i++){tick();if(i%10===0)await new Promise(r=>setTimeout(r,0));}
   const unit=driveby.snapshot().units[0];
   if(!unit)throw new Error(JSON.stringify(driveby.snapshot()));
   const poses=driveby.poses();
   for(let i=0;i<1200&&unit.mission!=='attack';i++){tick();if(i%50===0)await new Promise(r=>setTimeout(r,0));unit.mission=driveby.snapshot().units[0]?.mission;}
   const end=driveby.snapshot().units[0];
   // The attack run opens fire: tracers leave the window and the mark bleeds.
   for(let i=0;i<900&&shots===0;i++){tick();if(i%50===0)await new Promise(r=>setTimeout(r,0));}
   const hp=sim.player.health;
   // Crew views load asynchronously (cold caches take a while); give them their fetches before counting.
   for(let i=0;i<300&&occupants.snapshot().drivers<2;i++){tick();await new Promise(r=>setTimeout(r,20));}
   return {gang:unit.gang,mission:end?.mission??unit.mission,speed:end?.speed??0,shots,hp,poses:poses.map((p:any)=>({key:p.key.split(':')[0],clip:p.clip,gun:!!p.gun,model:p.model})),views:occupants.snapshot().drivers,error:occupants.snapshot().error};
  }finally{driveby.dispose();occupants.dispose();fleet.dispose();sim.dispose();}
});
 expect(result.gang).toBe(0);
 expect(result.mission).toBe('attack');
 expect(result.speed).toBeGreaterThan(3);
 expect(result.shots).toBeGreaterThan(0);
 expect(result.hp).toBeLessThan(100);
 expect(result.poses).toEqual([{key:'driveby-driver',clip:'car_sit',gun:false,model:expect.any(String)},{key:'driveby-shooter',clip:expect.stringMatching(/^gang_driveby/),gun:true,model:expect.any(String)}]);
 expect(result.error).toBeNull();
 expect(result.views).toBe(2);
});
