import {test,expect} from '@playwright/test';
test('fixed native car generators assemble their original vehicle resources',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const paths=['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldCar.ts','/src/simulation/installNativeCar.ts','/tests/fixtures/native-render-dependencies.ts'];
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldCar,FIXED_CAR_HANDLING_IDS},{installNativeCar},{THREE,RAPIER}]=await Promise.all(paths.map(p=>import(p)));
  await RAPIER.init();const source=await openStaticWorld(new URL('/play/world/',location.href).href),catalog=await openStaticWorldVehicles(source),world=new RAPIER.World({x:0,y:0,z:0}),scene=new THREE.Scene(),success=[],failures=[],spawnFailures=[];let checkedSpawns=0;
  try{for(const vehicle of catalog.definitions.filter((v:any)=>v.type==='car'&&FIXED_CAR_HANDLING_IDS[v.handling]!==undefined)){
   try{const assets=await loadFixedWorldCar(catalog,{modelId:vehicle.id,primaryColor:-1,secondaryColor:-1}),car=installNativeCar(world,scene,assets,{position:{x:0,y:2,z:0},rotation:{x:0,y:0,z:0,w:1}},{friction:.4,restitution:0});car.update(1);success.push({id:vehicle.id,name:vehicle.model,wheels:Object.keys(car.wheelSnapshot()).length});car.dispose();}
   catch(error){failures.push({id:vehicle.id,name:vehicle.model,error:String(error)});}
  }
  const workerPath='/src/assets/staticWorld.worker.ts',worker=new Worker(workerPath,{type:'module'});
  try{
   const ready:any=await new Promise((resolve,reject)=>{worker.onmessage=({data})=>data.type==='error'?reject(new Error(data.message)):resolve(data);worker.onerror=e=>reject(new Error(e.message));worker.postMessage({action:'initialize',base:new URL('/play/world/',location.href).href});});
   for(const record of ready.carGenerators){const vehicle=catalog.definitions.find((v:any)=>v.id===record.modelId);if(vehicle?.type!=='car')continue;
    checkedSpawns++;try{await loadFixedWorldCar(catalog,record);}catch(error){spawnFailures.push({id:record.id,error:String(error)});}
   }
  }finally{worker.terminate();}
  }finally{world.free();}
  return {success,failures,spawnFailures,checkedSpawns,children:scene.children.length};
 });
 console.log(JSON.stringify(result));expect(result.children).toBe(0);expect(result.success).toHaveLength(65);expect(result.success.every(v=>v.wheels===4)).toBe(true);
 expect(result.failures).toEqual([]);expect(result.checkedSpawns).toBe(129);expect(result.spawnFailures).toEqual([]);
});

test('native fixed spawn becomes a drivable car on its original streamed terrain',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const paths=['/src/simulation/WorldFleet.ts','/src/simulation/Simulation.ts','/src/simulation/nativeScene.ts','/src/assets/worldRoadMaterials.ts','/tests/fixtures/native-render-dependencies.ts'];
  const [{WorldFleet},{Simulation},{installNativeScene},{loadWorldRoadMaterials},{THREE,RAPIER}]=await Promise.all(paths.map(p=>import(p)));
  await RAPIER.init();const workerPath='/src/assets/staticWorld.worker.ts',worker=new Worker(workerPath,{type:'module'}),base=new URL('/play/world/',location.href).href;
  const receive=()=>new Promise<any>((resolve,reject)=>{worker.onmessage=({data})=>data.type==='error'?reject(new Error(data.message)):resolve(data);worker.onerror=e=>reject(new Error(e.message));});
  const sim=new Simulation(),scene=new THREE.Scene();let terrain:any,fleet:any;
  try{
   let pending=receive();worker.postMessage({action:'initialize',base});const ready=await pending,record=ready.carGenerators.find((r:any)=>r.modelId===402);
   pending=receive();worker.postMessage({action:'region',id:1,region:{x:record.position[0],y:record.position[1],radius:180,includeCollisionBounds:true}});const data=await pending;
   terrain=installNativeScene(sim.world,scene,data.parts,{datasetIdentity:data.datasetIdentity});sim.world.step();
   sim.player.position={x:record.position[0]+3,y:record.position[2],z:-record.position[1]};
   fleet=new WorldFleet(sim,scene,await loadWorldRoadMaterials(base),undefined,base);fleet.setGenerators([{...record,id:record.id+':missing-floor',position:[record.position[0]+1,record.position[1],-50]},record]);
   for(let i=0;i<200&&!fleet.cars.size;i++){fleet.update(i*501);await new Promise(resolve=>setTimeout(resolve,25));}
   if(!fleet.cars.size)throw new Error(JSON.stringify(fleet.snapshot()));
   const car=[...fleet.cars][0] as any;
   const tick=(drive:number)=>{car.beforeStep(1/60,{x:0,y:drive},false,terrain.sources);sim.world.step();car.afterStep();};
   for(let i=0;i<120;i++)tick(0);
   const support=car.car.assertTerrainSupport(terrain.sources.keys());let missingTerrainRejected=false;try{car.car.assertTerrainSupport([]);}catch{missingTerrainRejected=true;}
   const before={...car.car.body.translation()};sim.player.position={x:before.x+2,y:before.y,z:before.z};const message=car.interact();
   for(let i=0;i<180;i++)tick(1);
   const after={...car.car.body.translation()},rotation=car.car.wheelSnapshot().frontLeft.rotation;
   pending=receive();worker.postMessage({action:'region',id:2,region:{x:after.x-75,y:-after.z,radius:180,includeCollisionBounds:true}});const next=await pending;
   terrain=terrain.replace(next.parts,(candidate:any)=>car.car.assertTerrainSupport(candidate.sources.keys()),next.datasetIdentity);
   const seamPosition={...car.car.body.translation()};for(let i=0;i<30;i++)tick(1);
   fleet.setGenerators([record]);fleet.update(200000);await new Promise(resolve=>setTimeout(resolve,100));
   return {support,missingTerrainRejected,seamPosition,id:car.modelId,occupied:car.occupied,message,before,after,rotation,count:fleet.cars.size,failures:fleet.snapshot().failures};
  }finally{fleet?.dispose();terrain?.dispose();sim.dispose();worker.terminate();}
 });
 console.log(JSON.stringify(result));expect(result.missingTerrainRejected).toBe(true);expect(Math.abs(result.support.y-result.before.y)).toBeLessThan(2);expect(result.id).toBe(402);expect(result.occupied).toBe(true);expect(result.seamPosition).toEqual(result.after);expect(result.count).toBe(1);expect(result.failures).toEqual([]);expect(Math.hypot(result.after.x-result.before.x,result.after.z-result.before.z)).toBeGreaterThan(3);expect(Math.abs(result.rotation)).toBeGreaterThan(1);
});
