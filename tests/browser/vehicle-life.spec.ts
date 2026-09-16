import {test,expect} from '@playwright/test';
test('native cars show seated drivers and damaged component models',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldCar},{loadWorldRoadMaterials},{WorldCar},{Simulation},{VehicleOccupants,driverSeat},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldCar.ts','/src/assets/worldRoadMaterials.ts','/src/simulation/WorldCar.ts','/src/simulation/Simulation.ts','/src/render/VehicleOccupants.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href,source=await openStaticWorld(base),catalog=await openStaticWorldVehicles(source),assets=await loadFixedWorldCar(catalog,{modelId:492,primaryColor:53,secondaryColor:0}),sim=new Simulation(),scene=new THREE.Scene(),road=await loadWorldRoadMaterials(base),car=new WorldCar(sim,scene,assets,{x:0,y:0,z:0},road),occupants=new VehicleOccupants(scene,base);car.autopilot={throttle:0,brake:0,steering:0,handbrake:true};car.setLighting([1,1,1],[1,1,1],1,0);car.car.update(1);
  for(let i=0;i<100&&!occupants.snapshot().drivers;i++){occupants.update(occupants.drivers([car]),[1,1,1],0);await new Promise(r=>setTimeout(r,25));}
  const seat=driverSeat(car)?.toArray(),before=occupants.snapshot();
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(900,650);renderer.setClearColor(0x717b80);renderer.domElement.id='vehicle-preview';renderer.domElement.style.cssText='position:fixed;inset:0;z-index:9999';document.body.append(renderer.domElement);const camera=new THREE.PerspectiveCamera(40,900/650,.1,100);camera.position.set(-5,2.5,-5);camera.lookAt(0,.6,0);renderer.render(scene,camera);
  (window as any).__vehiclePreview={damage(){for(const [handle,source] of car.car.sources as Map<number,any>)if(source.kind!=='mesh'&&source.surface.flags>0)for(let i=0;i<3;i++)car.damage(120,handle);renderer.render(scene,camera);},dispose(){occupants.dispose();car.dispose();sim.dispose();renderer.dispose();}};
  return {seat,before};
 });expect(result.seat).toHaveLength(3);expect(result.before.error).toBeNull();expect(result.before.drivers).toBe(1);await page.locator('#vehicle-preview').screenshot({path:'artifacts/vehicle-driver.png'});await page.evaluate(()=>(window as any).__vehiclePreview.damage());await page.locator('#vehicle-preview').screenshot({path:'artifacts/vehicle-damage.png'});await page.evaluate(()=>(window as any).__vehiclePreview.dispose());
});
test('traffic has visible drivers and native engine audio with bounded voices',async({page})=>{
 test.setTimeout(120000);await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});const state=()=>page.evaluate(()=>(window as any).__game.state());await expect.poll(async()=>(await state()).occupants.drivers,{timeout:15000}).toBeGreaterThan(0);const engines=async()=>((await state()).audio.native?.vehicles??[]).filter((v:{sounds:number[]})=>v.sounds.length>0).length;await expect.poll(engines,{timeout:20000}).toBeGreaterThan(0);expect((await state()).audio.native.physical).toBeLessThanOrEqual(47);await page.keyboard.press('Escape');await expect.poll(async()=>(await state()).audio.context).toBe('suspended');const frames=(await state()).audio.native.frames;await page.waitForTimeout(300);expect((await state()).audio.native.frames).toBe(frames);await page.getByRole('button',{name:'Resume game',exact:true}).click();await expect.poll(async()=>(await state()).audio.native.frames).toBeGreaterThan(frames);await expect.poll(engines).toBeGreaterThan(0);
});
test('crashing a native car applies VehicleDamage health loss and dents the struck components',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldCar},{loadWorldRoadMaterials},{WorldCar},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldCar.ts','/src/assets/worldRoadMaterials.ts','/src/simulation/WorldCar.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href,catalog=await openStaticWorldVehicles(await openStaticWorld(base)),assets=await loadFixedWorldCar(catalog,{modelId:492,primaryColor:53,secondaryColor:0}),sim=new Simulation(),scene=new THREE.Scene(),road=await loadWorldRoadMaterials(base);
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(0,-.5,0));sim.world.createCollider(RAPIER.ColliderDesc.cuboid(6,3,.5).setTranslation(0,3,-30));sim.world.step();
  const car=new WorldCar(sim,scene,assets,{x:0,y:1.2,z:0},road,0);sim.player.position={x:0,y:1,z:0};car.interact();
  try{
   for(let i=0;i<120;i++){car.beforeStep(1/60,{x:0,y:0},false);sim.world.step();car.afterStep();}
   const settled=car.health;car.car.body.setLinvel({x:0,y:0,z:-22},true);
   let impact=0;for(let i=0;i<240;i++){car.beforeStep(1/60,{x:0,y:0},false);sim.world.step();car.afterStep();if(car.health<settled&&!impact)impact=i;}
   return {settled,health:car.health,impact,panels:[...car.damageState.panels],doors:[...car.damageState.doors],wrecked:car.wrecked};
  }finally{car.dispose();sim.dispose();}
 });
 expect(result.settled).toBe(1000);expect(result.health).toBeLessThan(1000);expect(result.health).toBeGreaterThan(250);expect(result.wrecked).toBe(false);expect(result.panels[5]+result.doors[0]).toBeGreaterThan(0);
});
