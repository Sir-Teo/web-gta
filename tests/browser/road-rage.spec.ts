import {test,expect} from '@playwright/test';

test('a driver rammed by the player draws his decision: road rage gets him out to face, shake a fist and fight; a flee-scene drive speeds off',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{WorldTraffic},{WorldFleet},{WorldPedestrians},{WantedSystem},{CarEntry},{VehicleAnimationLibrary},{Simulation},{loadWorldRoadMaterials},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldTraffic.ts','/src/simulation/WorldFleet.ts','/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/CarEntry.ts','/src/assets/vehicleAnimations.ts','/src/simulation/Simulation.ts','/src/assets/worldRoadMaterials.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(700,.5,700).setTranslation(2490,12,1680));sim.respawn={x:2495,y:12.55,z:1687};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const fleet=new WorldFleet(sim,scene,await loadWorldRoadMaterials(base),undefined,base),traffic=new WorldTraffic(sim,fleet,base) as any;
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined,new WantedSystem()) as any;
  crowd.pedTargets=()=>({dealers:0,gangs:0,cops:0,other:0,gangStrengths:Array(10).fill(0)});
  const entry=new CarEntry(sim,new VehicleAnimationLibrary(base));
  try{
   for(let i=0;i<300&&(traffic.snapshot().cars.length<2||!crowd.snapshot().ready);i++){traffic.update(i*2100);crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   if(fleet.cars.size<2)throw new Error(JSON.stringify(traffic.snapshot()));
   let car=[...fleet.cars][0] as any;await entry.clips.load(car.animGroup);
   let follow=true;
   const tick=()=>{crowd.update(performance.now());if(follow){const at=car.car.body.translation();sim.player.position={x:at.x+10,y:at.y,z:at.z+10};}traffic.beforeStep(1/60);entry.step(1/60,{pedal:false,moving:false});crowd.beforeStep(1/60,[...fleet.cars]);for(const c of fleet.cars)c.beforeStep(1/60,{x:0,y:0},false);sim.world.step();for(const c of fleet.cars)c.afterStep(1/60);crowd.afterStep();};
   const ahead=(distance:number)=>{const p=car.car.body.translation(),q=car.car.body.rotation(),heading=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.x*q.x+q.y*q.y));
    return {position:{x:p.x-Math.sin(heading)*distance,y:p.y,z:p.z-Math.cos(heading)*distance},heading};};
   for(let i=0;i<120;i++)tick();
   // A car made partway along its link (GenerateOneRandomCar's place) can be turning at a junction by now: take a car
   // that has run straight along its link, moving, for half a second, so the blocker lands in its lane.
   const straight=new Map<any,number>();
   for(let i=0;i<900;i++){
    tick();
    for(const c of traffic.snapshot().cars){const owner=[...fleet.cars].find((f:any)=>{const at=f.car.body.translation();return Math.hypot(c.position.x-at.x,c.position.z-at.z)<1;});
     if(owner)straight.set(owner,c.alignment>.98&&c.speed>3?(straight.get(owner)??0)+1:0);}
    const pick=[...straight].find(([,n])=>n>=30)?.[0];if(pick){car=pick;await entry.clips.load(car.animGroup);break;}
   }
   // A blocker parks the car in its lane; the player's car then rams it from behind at 12 m/s.
   const spot=ahead(14),blocker=await fleet.spawnTrafficCar(492,spot.position,spot.heading);
   for(let i=0;i<300;i++)tick();
   const back=ahead(-11),ram=await fleet.spawnTrafficCar(492,back.position,back.heading);
   car.playerVehicle=()=>ram;
   let raged=0,evicted=0,exitSpeed=-1;traffic.driverDecisionMaker=()=>2;traffic.random=()=>.7;
   traffic.onRoadRage=(c:any)=>{raged++;const lv=c.car.body.linvel();exitSpeed=Math.hypot(lv.x,lv.z);evicted+=entry.evictDriver(c,(position:any,heading:number)=>crowd.spawnRoadRage(0,position,heading,undefined))?1:0;};
   const forward={x:-Math.sin(back.heading)*12,z:-Math.cos(back.heading)*12};
   // The ram is driven in until the rammed driver decides on road rage; he then waits for his car to stop
   // (canPedStepOutCar), which a car still being shoved at 12 m/s never does.
   const rammedDriver=traffic.drivers.find((d:any)=>d.car===car);
   let hitAt=-1;for(let i=0;i<240;i++){if(hitAt<0&&!rammedDriver?.raged)ram.car.body.setLinvel({x:forward.x,y:0,z:forward.z},true);tick();if(raged&&hitAt<0)hitAt=i;if(hitAt>=0&&i>hitAt+30)break;}
   const snap=traffic.snapshot().cars.find((c:any)=>c.modelId===car.modelId&&Math.hypot(c.position.x-car.car.body.translation().x,c.position.z-car.car.body.translation().z)<1);
   const rammed={hitAt,raged,evicted,exitSpeed,driverOut:car.driverOut,autopilot:!!car.autopilot,health:car.health,snap:snap?{raged:snap.raged,fleeScene:snap.fleeScene}:null};
   // The player stands 8 m off the driver's door; the rager gets out, faces him, shakes a fist and comes over.
   follow=false;const door=car.car.body.translation();sim.player.position={x:door.x+8,y:door.y,z:door.z};
   let exitFrames=0;for(let i=0;i<300;i++){tick();if(i%20===0)await new Promise(r=>setTimeout(r,40));if(entry.npcPoses().length)exitFrames++;if(exitFrames&&!entry.npcPoses().length&&i>30)break;}
   for(let i=0;i<10;i++){tick();await new Promise(r=>setTimeout(r,40));}
   const rager=crowd.people.find((p:any)=>p.rage||p.retaliate>0);
   const phases:string[]=[];let fistClip=false,attackAt=-1,closest=Infinity;
   for(let i=0;i<600;i++){tick();if(!rager)break;const ph=rager.rage?.phase??(rager.retaliate>0?'seek':'idle');if(phases[phases.length-1]!==ph)phases.push(ph);
    if(rager.view.reactionName==='fucku')fistClip=true;if(rager.retaliate>0&&attackAt<0)attackAt=i;
    if(attackAt>=0){closest=Math.min(closest,Math.hypot(rager.actor.player.position.x-sim.player.position.x,rager.actor.player.position.z-sim.player.position.z));if(i>attackAt+180)break;}}
   const rage={people:crowd.people.length,found:!!rager,exitFrames,phases,fistClip,attackAt,closest,retaliate:rager?.retaliate??null,foe:rager?.foe?'ped':'player'};
   // A second driver's draw lands on the flee-scene drive: cruise speed 40 avoiding cars.
   const other=traffic.drivers.find((d:any)=>d.car!==car);const beforeFlee={cruise:other?.cruiseSpeed,avoid:other?.avoidCars};
   traffic.random=()=>.5;traffic.collisionEvent(other,10,true);
   const flee={cruise:other?.cruiseSpeed,avoid:other?.avoidCars,fleeScene:!!other?.fleeScene,raged:!!other?.raged};
   traffic.collisionEvent(other,3,true);const small={cruise:other?.cruiseSpeed};
   return {rammed,rage,beforeFlee,flee,small};
  }finally{crowd.dispose();traffic.dispose();fleet.dispose();sim.dispose();}
 });
 // The ram costs the car over 5 raw health; the R_Norm draw at .9 is road rage, and the driver is put out.
 expect(result.rammed.hitAt).toBeGreaterThanOrEqual(0);
 // CTaskSimpleCarWaitToSlowDown: he gets out once the shunted car has all but stopped.
 expect(result.rammed.exitSpeed).toBeLessThan(1.5);expect(result.rammed.raged).toBe(1);expect(result.rammed.evicted).toBe(1);
 expect(result.rammed.driverOut).toBe(true);expect(result.rammed.autopilot).toBe(false);expect(result.rammed.health).toBeLessThan(1000);
 expect(result.rammed.snap?.raged).toBe(true);
 // Out of the car he turns to face the player, shakes his fist (FUCKU) and then seeks him to fight (20 s).
 expect(result.rage.found).toBe(true);expect(result.rage.exitFrames).toBeGreaterThan(20);
 // (He may already face the player when sampled; the fist shake then the seek always follow in order.)
 const order=result.rage.phases.join('>');expect(order.startsWith('face>shake>seek')||order.startsWith('shake>seek')).toBe(true);
 expect(result.rage.fistClip).toBe(true);expect(result.rage.foe).toBe('player');
 expect(result.rage.retaliate).toBeGreaterThan(15);expect(result.rage.closest).toBeLessThan(3);
 // The flee-scene drive: cruise 40, DRIVING_STYLE_AVOID_CARS; a light bump (5 raw health or less) is no event. Before
 // it the car has its GenerateOneRandomCar cruise, 13 to 20 (21 at rand()'s very top).
 expect(result.beforeFlee.cruise).toBeLessThanOrEqual(21);expect(result.beforeFlee.avoid).toBe(false);
 expect(result.flee).toEqual({cruise:40,avoid:true,fleeScene:true,raged:false});
 expect(result.small.cruise).toBe(40);
});
