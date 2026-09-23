import {test,expect} from '@playwright/test';
test('peds only appear in view far out, bullets cause damage without universal knockdown, one-star police hold fire until the suspect holds a gun',async({page})=>{
 test.setTimeout(90000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),law=new WantedSystem();sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();
  const crowd=new WorldPedestrians(sim,scene,new URL('/play/world/',location.href).href,()=>undefined,law);crowd.canSpawn=()=>false;
  try{
   for(let i=0;i<200&&!crowd.snapshot().ready;i++)await new Promise(r=>setTimeout(r,20));
   crowd.update(0);await new Promise(r=>setTimeout(r,200));const p0=sim.player.position,hidden=crowd.snapshot().people.filter((p:any)=>Math.hypot(p.position.x-p0.x,p.position.z-p0.z)<42).length;
   crowd.canSpawn=()=>true;
   for(let i=1;i<200&&!crowd.targets().length;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const target=crowd.targets()[0];crowd.damageCollider(target.handle,10,{x:0,z:1},'bullet');const hurt=crowd.snapshot().people.find((p:any)=>p.id===0);
   law.setLevel(2);for(let i=300;i<500&&!crowd.snapshot().people.some((p:any)=>p.officer);i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   let shots=0;crowd.onShot=()=>shots++;law.setLevel(1);
   for(let i=0;i<180;i++){crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();}const oneStar=shots;
   // CTaskComplexPolicePursuit::SetWeapon: at one star the pistol comes out once the suspect holds a gun.
   // (Raising the level instead would not do it: a cop keeps a drawn nightstick above one star.)
   crowd.playerArmed=()=>true;sim.player.health=1000;
   for(let i=0;i<600;i++){crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();}
   return {hidden,hurt,oneStar,shots,error:crowd.snapshot().error};
  }finally{crowd.dispose();sim.dispose();}
 });
 // CPopulation::Update: a spot the camera sees only takes a ped 42.5 to 50.5 units out.
 expect(result.hidden).toBe(0);expect(result.hurt.health).toBe(90);expect(result.hurt.state).toBe('flee');expect(result.oneStar).toBe(0);expect(result.shots).toBeGreaterThan(2);expect(result.error).toBeNull();
});

test('vehicle spawn revalidates authorization after model load and keeps distant low-detail cars visible',async({page})=>{
 test.setTimeout(90000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
 const [{WorldFleet},{Simulation},{loadWorldRoadMaterials},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldFleet.ts','/src/simulation/Simulation.ts','/src/assets/worldRoadMaterials.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
 await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(0,-.5,0));sim.respawn={x:20,y:0,z:20};sim.resetPlayer();sim.world.step();
 const fleet=new WorldFleet(sim,scene,await loadWorldRoadMaterials(base),undefined,base);
 try{
  let publish=true;const pending=fleet.spawnTrafficCar(596,{x:0,y:0,z:0},0,()=>publish);publish=false;const canceled=await pending;
  const rejected=canceled===undefined&&fleet.cars.size===0;
  const car=await fleet.spawnTrafficCar(596,{x:0,y:0,z:0},0);if(!car)throw Error('No car');sim.player.position={x:0,y:0,z:150};car.beforeStep(1/60,{x:0,y:0},false);
  const low=car.car.setViewDistance(150**2,1),visible=car.car.root.visible,far=car.car.setViewDistance(220**2,1);
  return {rejected,visible,low:low.detail,far:far.detail};
 }finally{fleet.dispose();sim.dispose();}
 });expect(result).toEqual({rejected:true,visible:true,low:'low',far:'culled'});
});
