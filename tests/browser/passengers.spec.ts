import {test,expect} from '@playwright/test';

test('a recruited homie boards, rides and climbs back out',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldCar},{loadWorldRoadMaterials},{WorldCar},{Simulation},{CarEntry},{VehicleAnimationLibrary},{openWorldPedestrians},{WorldPedestrians},{VehicleOccupants},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldCar.ts','/src/assets/worldRoadMaterials.ts','/src/simulation/WorldCar.ts','/src/simulation/Simulation.ts','/src/simulation/CarEntry.ts','/src/assets/vehicleAnimations.ts','/src/assets/worldPedestrians.ts','/src/simulation/WorldPedestrians.ts','/src/render/VehicleOccupants.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href;
  const catalog=await openStaticWorldVehicles(await openStaticWorld(base)),road=await loadWorldRoadMaterials(base);
  const sim=new Simulation(),scene=new THREE.Scene();
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const car=new WorldCar(sim,scene,await loadFixedWorldCar(catalog,{modelId:492,primaryColor:53,secondaryColor:0}),{x:2490,y:13.6,z:1680},road);
  const entry=new CarEntry(sim,new VehicleAnimationLibrary(base));await entry.clips.load(car.animGroup);
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined);
  const occupants=new VehicleOccupants(scene,base);
  crowd.gangTurf=()=>({gang:1,strength:255});entry.crowd=crowd;
  const out:Record<string,unknown>={};
  try{
   for(let i=0;i<300&&!crowd.snapshot().people.some((p:any)=>p.gang===1);i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const tick=()=>{entry.stepPassengers(1/60);crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();occupants.update([...entry.passengerPoses()],[.7,.7,.7],0);};
   for(let i=0;i<30;i++)tick();
   const mark=crowd.snapshot().people.find((p:any)=>p.gang===1);
   if(!mark)throw new Error('No Families member');
   sim.player.position={x:mark.position.x+2,y:mark.position.y,z:mark.position.z};
   sim.playerBody.setTranslation({x:mark.position.x+2,y:mark.position.y+.9,z:mark.position.z},true);
   sim.playerBody.setNextKinematicTranslation({x:mark.position.x+2,y:mark.position.y+.9,z:mark.position.z});
   sim.world.step();sim.player.heading=-Math.PI/2;
   out.recruited=crowd.groupControl('forward',{range:10});
   // Park the player beside the Greenwood and warp into the driver seat.
   sim.player.position={x:2492,y:12.55,z:1680};sim.player.heading=0;
   sim.playerBody.setTranslation({x:2492,y:13.45,z:1680},true);
   sim.playerBody.setNextKinematicTranslation({x:2492,y:13.45,z:1680});
   sim.world.step();
   // The front-right door shot off: its seat still takes a rider (the door just does not open).
   car.damageState.doors[3]=4;out.maxPassengers=car.maximumPassengers;
   // Seats 1 and 3 have their own doors: the rear-right point stands behind the front-right one.
   {const front=entry.seatDoorPoint(car,0),rear=entry.seatDoorPoint(car,2);out.rearGap=front&&rear?Math.hypot(front.x-rear.x,front.y-rear.y):0;}
   entry.warpIn(car);
   for(let i=0;i<600&&!entry.snapshot().passengers.length;i++){tick();if(i%50===0)await new Promise(r=>setTimeout(r,0));}
   out.boarded=entry.snapshot().passengers.length;
   out.streetLeft=crowd.snapshot().people.length;
   out.pose=entry.passengerPoses().map((p:any)=>({clip:p.clip,seat:1}));
   // Roll the car twenty metres: the crew rides along.
   car.car.body.setTranslation({x:2510,y:13.6,z:1680},true);
   car.car.body.setNextKinematicTranslation({x:2510,y:13.6,z:1680});
   for(let i=0;i<60;i++){tick();if(i%20===0)await new Promise(r=>setTimeout(r,0));}
   out.kept=entry.snapshot().passengers.length;
   out.views=occupants.snapshot().drivers;
   out.occReady=occupants.snapshot().ready;
   out.occError=occupants.snapshot().error;
   const seat=car.car.body.translation();
   // Climb out: the crew takes the doors and keeps following.
   entry.abandon();
   for(let i=0;i<60;i++){tick();if(i%10===0)await new Promise(r=>setTimeout(r,0));}
   const crew=crowd.snapshot().people.filter((p:any)=>p.follow);
   out.ejected=entry.snapshot().passengers.length;
   out.regained=crew.length;
   out.nearCar=crew.length?Math.hypot(crew[0].position.x-seat.x,crew[0].position.z-seat.z):null;
   return out;
  }finally{entry.crowd=undefined;occupants.dispose();crowd.dispose();car.dispose();sim.dispose();}
 });
 expect(result.recruited).toBe('joined');
 expect(result.maxPassengers).toBe(3);expect(result.rearGap).toBeGreaterThan(.5);expect(result.boarded).toBe(1);
 expect({ready:result.occReady,error:result.occError,views:result.views}).toEqual({ready:true,error:null,views:1});
 expect(result.pose).toEqual([{clip:'car_sitp',seat:1}]);
 expect(result.kept).toBe(1);
 expect(result.ejected).toBe(0);
 expect(result.regained).toBe(1);
 expect(result.nearCar).toBeLessThan(6);
 expect(errors).toEqual([]);
});
