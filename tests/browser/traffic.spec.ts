import {test,expect} from '@playwright/test';

test('native traffic follows its lane, slows behind a car and for a pedestrian, and relinquishes control',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{WorldTraffic},{WorldFleet},{Simulation},{loadWorldRoadMaterials},{THREE,RAPIER},{playHornIfNecessary}]=await Promise.all(['/src/simulation/WorldTraffic.ts','/src/simulation/WorldFleet.ts','/src/simulation/Simulation.ts','/src/assets/worldRoadMaterials.ts','/tests/fixtures/native-render-dependencies.ts','/src/simulation/nativeCarHorn.ts'].map(p=>import(p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  // Native cruise speeds cover 250 units in the long run: the floor reaches well past it.
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(700,.5,700).setTranslation(2490,12,1680));sim.respawn={x:2495,y:12.55,z:1687};sim.resetPlayer();sim.world.step();
  const fleet=new WorldFleet(sim,scene,await loadWorldRoadMaterials(base),undefined,base),traffic=new WorldTraffic(sim,fleet,base);
  try{
   for(let i=0;i<300&&!traffic.snapshot().cars.length;i++){traffic.update(i*2100);await new Promise(r=>setTimeout(r,20));}
   if(!fleet.cars.size)throw new Error(JSON.stringify(traffic.snapshot()));
   const car=[...fleet.cars][0] as any;
   // The player keeps up with the car, as the streaming window would: cars beyond 100 units are suspended.
   const tick=()=>{const at=car.car.body.translation();sim.player.position={x:at.x+10,y:at.y,z:at.z+10};traffic.beforeStep(1/60);for(const c of fleet.cars)c.beforeStep(1/60,{x:0,y:0},false);sim.world.step();for(const c of fleet.cars)c.afterStep();};
   const ahead=(distance:number)=>{const p=car.car.body.translation(),q=car.car.body.rotation(),heading=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.x*q.x+q.y*q.y));
    return {position:{x:p.x-Math.sin(heading)*distance,y:p.y,z:p.z-Math.cos(heading)*distance},heading};};
   for(let i=0;i<360;i++)tick();const moving=traffic.snapshot();
   // A car parked in the lane ahead: SlowCarDownForOtherCar brings the driver to a stop behind it.
   const spot=ahead(14),blocker=await fleet.spawnTrafficCar(492,spot.position,spot.heading);
   // It stops behind the car; on the road it has always just collided, so CCarAI's jam recovery may then back it up,
   // honk and take it round (DRIVINGSTYLE_AVOID_CARS) within the wait. The first stop is what is checked, and the
   // pedestrian comes from there. The last 2 units before the stop 1 unit short are a crawl at 1 CarAI unit (0.83 units
   // a second), so it takes a while.
   let stopped:any;for(let i=0;i<720&&!stopped;i++){tick();const c=traffic.snapshot().cars[0];if(c.stopped==='obstacle'&&c.speed<1)stopped=traffic.snapshot();}
   stopped??=traffic.snapshot();
   fleet.removeTrafficCar(blocker);
   // A jam reverse still running overrides the pedals; the pedestrian comes once the car drives its lane again.
   for(let i=0;i<180&&traffic.snapshot().cars[0].temp;i++)tick();
   // A jam turns the car to DRIVINGSTYLE_AVOID_CARS for good, which steers round rather than slowing; the pedestrian
   // check is for a STOP_FOR_CARS driver, so this one gets that style back.
   for(const d of (traffic as any).drivers)d.avoidCars=false;
   // A pedestrian in the lane: SlowCarDownForPedsSectorList slows the car and raises bHonkAtPed.
   const walker=ahead(7).position;traffic.peds=()=>[walker];
   let honked=0,pedHonk=false,closest=Infinity;
   for(let i=0;i<120;i++){tick();pedHonk||=car.honkAtPed;if(i%2===0)playHornIfNecessary(car,()=>106/32768);honked=Math.max(honked,car.horn.counter);
    const p=car.car.body.translation();closest=Math.min(closest,Math.hypot(p.x-walker.x,p.z-walker.z));}
   const blockedByPed={pedHonk,closest};
   traffic.peds=()=>[];car.horn.counter=0;
   // Lane keeping on straights: while the car heads along its link (within 11 degrees), not mid-turn onto a new one,
   // following its path (not after a jam's reverse has put it off its lane, nor at the end of its route).
   let maxLaneError=0,alignedSamples=0;for(let i=0;i<1800;i++){tick();const c=traffic.snapshot().cars[0];if(i>300&&c.alignment>.98&&!c.avoidCars&&c.stopped!=='end of route'){alignedSamples++;maxLaneError=Math.max(maxLaneError,c.laneError);}}const longRun=traffic.snapshot();
   car.car.body.setLinvel({x:0,y:0,z:0},true);const at=car.car.body.translation();sim.player.position={x:at.x+2,y:at.y,z:at.z};const entered=car.interact();traffic.beforeStep(1/60);const takeover={occupied:car.occupied,autopilot:car.autopilot??null,entered};
   const exit=car.interact();traffic.beforeStep(1/60);const parked=!car.autopilot;sim.player.position={x:1000,y:13,z:1000};traffic.update(1e8);const retired=fleet.cars.size;
   return {exit,parked,retired,moving,longRun,maxLaneError,alignedSamples,stopped,takeover,blockedByPed,honked};
  }finally{traffic.dispose();fleet.dispose();if(scene.children.length)throw new Error('Traffic views leaked');sim.dispose();}
 });
 expect(result.moving.error).toBeNull();expect(result.moving.cars[0].distance).toBeGreaterThan(5);
 // GenerateOneRandomCar cruise speeds (iOS): 13 to 20 CarAI units (21 at rand()'s very top), three quarters of that
 // for a vehicle over 10 long.
 expect(result.moving.cars[0].cruiseSpeed).toBeGreaterThanOrEqual(9);expect(result.moving.cars[0].cruiseSpeed).toBeLessThanOrEqual(21);
 expect(result.stopped.cars[0].stopped).toBe('obstacle');expect(result.stopped.cars[0].speed).toBeLessThan(1);expect(result.stopped.cars[0].honk.car).toBe(true);
 // The car stops with its nose short of the pedestrian (a Greenwood's front is 2.9 units from its centre).
 expect(result.blockedByPed.pedHonk).toBe(true);expect(result.blockedByPed.closest).toBeGreaterThan(3);expect(result.honked).toBe(45);
 expect(result.longRun.cars[0].distance).toBeGreaterThan(result.stopped.cars[0].distance+15);expect(result.parked).toBe(true);expect(result.exit).toBe('On foot');expect(result.retired).toBe(0);
 // On straights the car keeps to its 5.4-unit lane.
 expect(result.alignedSamples).toBeGreaterThan(100);expect(result.maxLaneError).toBeLessThan(2.7);
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
