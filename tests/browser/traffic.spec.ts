import {test,expect} from '@playwright/test';

test('native traffic drives road links, brakes for obstacles, and relinquishes control',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{WorldTraffic},{WorldFleet},{Simulation},{loadWorldRoadMaterials},{THREE,RAPIER},{playHornIfNecessary}]=await Promise.all(['/src/simulation/WorldTraffic.ts','/src/simulation/WorldFleet.ts','/src/simulation/Simulation.ts','/src/assets/worldRoadMaterials.ts','/tests/fixtures/native-render-dependencies.ts','/src/simulation/nativeCarHorn.ts'].map(p=>import(p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));sim.respawn={x:2495,y:12.55,z:1687};sim.resetPlayer();sim.world.step();
  const fleet=new WorldFleet(sim,scene,await loadWorldRoadMaterials(base),undefined,base),traffic=new WorldTraffic(sim,fleet,base);
  try{
   for(let i=0;i<300&&!traffic.snapshot().cars.length;i++){traffic.update(i*2100);await new Promise(r=>setTimeout(r,20));}
   if(!fleet.cars.size)throw new Error(JSON.stringify(traffic.snapshot()));
   const car=[...fleet.cars][0] as any;
   const tick=()=>{traffic.beforeStep(1/60);for(const c of fleet.cars)c.beforeStep(1/60,{x:0,y:0},false);sim.world.step();for(const c of fleet.cars)c.afterStep();};
   const before={...car.car.body.translation()};for(let i=0;i<360;i++)tick();const moving=traffic.snapshot();
   const p=car.car.body.translation(),q=car.car.body.rotation(),heading=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.x*q.x+q.y*q.y)),forward={x:-Math.sin(heading),z:-Math.cos(heading)};
   const blocker=sim.world.createCollider(RAPIER.ColliderDesc.cuboid(2,2,2).setTranslation(p.x+forward.x*8,14,p.z+forward.z*8));sim.world.step();
   traffic.beforeStep(1/60);const braking=traffic.snapshot();for(let i=0;i<180;i++)tick();const stopped=traffic.snapshot();sim.world.removeCollider(blocker,true);
   // A pedestrian-like kinematic body in the lane raises bHonkAtPed; PlayCarHorn runs per 30 Hz frame (rand() 106 sounds at once).
   const walker=sim.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x+forward.x*6,p.y+.6,p.z+forward.z*6)),walkerCollider=sim.world.createCollider(RAPIER.ColliderDesc.capsule(.6,.3),walker);sim.world.step();
   let honked=0;for(let i=0;i<60;i++){tick();if(i%2===0)playHornIfNecessary(car,()=>106/32768);honked=Math.max(honked,car.horn.counter);}const blockedByPed=traffic.snapshot();
   sim.world.removeCollider(walkerCollider,true);sim.world.removeRigidBody(walker);car.horn.counter=0;
   let maxLaneError=0;for(let i=0;i<1800;i++){tick();maxLaneError=Math.max(maxLaneError,traffic.snapshot().cars[0].laneError);}const longRun=traffic.snapshot();
   car.car.body.setLinvel({x:0,y:0,z:0},true);const at=car.car.body.translation();sim.player.position={x:at.x+2,y:at.y,z:at.z};const entered=car.interact();traffic.beforeStep(1/60);const takeover={occupied:car.occupied,autopilot:car.autopilot??null,entered};
   const exit=car.interact();traffic.beforeStep(1/60);const parked=!car.autopilot;sim.player.position={x:1000,y:13,z:1000};traffic.update(1e8);const retired=fleet.cars.size;
   return {exit,parked,retired,before,moving,longRun,maxLaneError,braking,stopped,takeover,blockedByPed,honked};
  }finally{traffic.dispose();fleet.dispose();if(scene.children.length)throw new Error('Traffic views leaked');sim.dispose();}
 });

 expect(result.moving.error).toBeNull();expect(result.moving.cars[0].distance).toBeGreaterThan(5);
 expect(result.longRun.cars[0].distance).toBeGreaterThan(result.stopped.cars[0].distance+15);expect(result.parked).toBe(true);expect(result.exit).toBe('On foot');expect(result.retired).toBe(0);
 expect(result.maxLaneError).toBeLessThan(6);
 expect(result.braking.cars[0].stopped).toBe('obstacle');expect(result.stopped.cars[0].speed).toBeLessThan(1);
 // Walls stop traffic silently; pedestrians in the lane make it honk.
 expect(result.stopped.cars[0].honk).toEqual({car:false,ped:false,counter:0});
 expect(result.blockedByPed.cars[0].stopped).toBe('obstacle');expect(result.blockedByPed.cars[0].honk.ped).toBe(true);expect(result.honked).toBe(45);
 expect(result.takeover.occupied).toBe(true);expect(result.takeover.autopilot).toBeNull();
});

test('ambient cars move in Grove Street and pause with the world',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).traffic?.cars.length??0,{timeout:45000}).toBeGreaterThan(0);
 await expect.poll(async()=>Math.max(...(await state()).traffic.cars.map((c:any)=>c.distance)),{timeout:25000}).toBeGreaterThan(5);
 await page.screenshot({path:'artifacts/traffic-grove.png'});
 await page.keyboard.press('Escape');const paused=(await state()).traffic.cars;
 await page.waitForTimeout(300);expect((await state()).traffic.cars).toEqual(paused);
 expect((await state()).traffic.error).toBeNull();expect(errors).toEqual([]);
});

test('traffic cars render on the streamed native roadway',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');
 await page.evaluate(async()=>{
  const [{WorldTraffic},{WorldFleet},{Simulation},{loadWorldRoadMaterials},{installNativeScene},{THREE:T,RAPIER:R}]=await Promise.all(['/src/simulation/WorldTraffic.ts','/src/simulation/WorldFleet.ts','/src/simulation/Simulation.ts','/src/assets/worldRoadMaterials.ts','/src/simulation/nativeScene.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await R.init();const sim=new Simulation(),scene=new T.Scene(),base=new URL('/play/world/',location.href).href;
  const worker=new Worker('/src/assets/staticWorld.worker.ts',{type:'module'}),receive=()=>new Promise<any>((resolve,reject)=>{worker.onmessage=({data})=>data.type==='error'?reject(new Error(data.message)):resolve(data);worker.onerror=e=>reject(new Error(e.message));});
  let pending=receive();worker.postMessage({action:'initialize',base});await pending;
  pending=receive();worker.postMessage({action:'region',id:1,region:{x:2490,y:-1700,radius:160,includeCollisionBounds:true}});const data=await pending;worker.terminate();
  const terrain=installNativeScene(sim.world,scene,data.parts,{datasetIdentity:data.datasetIdentity});sim.respawn={x:2495,y:13.5,z:1687};sim.resetPlayer();sim.world.step();
  const fleet=new WorldFleet(sim,scene,await loadWorldRoadMaterials(base),undefined,base),traffic=new WorldTraffic(sim,fleet,base);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1000,650);renderer.setClearColor(0x81b8d1);renderer.domElement.id='traffic-native-road';renderer.domElement.style.cssText='position:fixed;inset:0;z-index:99999';document.body.append(renderer.domElement);
  try{
   for(let i=0;i<300&&!traffic.snapshot().cars.length;i++){traffic.update(i*2100);await new Promise(r=>setTimeout(r,20));}
   if(!fleet.cars.size)throw new Error(JSON.stringify(traffic.snapshot()));
   for(let i=0;i<180;i++){traffic.beforeStep(1/60);for(const car of fleet.cars)car.beforeStep(1/60,{x:0,y:0},false,terrain.sources);sim.world.step();}
   const car=[...fleet.cars][0] as any,p=car.car.body.translation();car.car.update(1);car.setLighting([.7,.7,.7],[.7,.7,.7],1,0);terrain.setTime(720,[.7,.7,.7]);
   const camera=new T.PerspectiveCamera(55,1000/650,.1,300);camera.position.set(p.x+7,p.y+4,p.z+8);camera.lookAt(p.x,p.y,p.z);camera.updateMatrixWorld();terrain.updateView(camera);renderer.render(scene,camera);
  }finally{traffic.dispose();fleet.dispose();terrain.dispose();sim.dispose();}
  (window as any).__disposeTrafficPreview=()=>renderer.dispose();
 });
 await page.locator('#traffic-native-road').screenshot({path:'artifacts/traffic-native-road.png'});
 await page.evaluate(()=>(window as any).__disposeTrafficPreview());
});
