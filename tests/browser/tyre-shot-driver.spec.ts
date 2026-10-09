import {test,expect} from '@playwright/test';

test('a tyre shot out makes the driver flee the scene at 40, or a weak driver leave the car and run 60 units',async({page})=>{
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
   const [first,second]=traffic.drivers;const car=first.car,other=second.car;await entry.clips.load(other.animGroup);
   let watched:any;const tick=()=>{crowd.update(performance.now());const at=watched?watched.actor.player.position:other.car.body.translation();sim.player.position={x:at.x+10,y:at.y,z:at.z+10};traffic.beforeStep(1/60);entry.step(1/60,{pedal:false,moving:false});crowd.beforeStep(1/60,[...fleet.cars]);for(const c of fleet.cars)c.beforeStep(1/60,{x:0,y:0},false);sim.world.step();for(const c of fleet.cars)c.afterStep(1/60);crowd.afterStep();};
   for(let i=0;i<60;i++)tick();
   // A normal driver's front tyre shot by the player: flee the scene (the draw at .5).
   traffic.driverDecisionMaker=(c:any)=>c===car?2:4;traffic.random=()=>.5;
   const before={cruise:first.cruiseSpeed,avoid:first.avoidCars};
   const burst=car.burstTyre(0,false,'player');
   const flee={burst,cruise:first.cruiseSpeed,avoid:first.avoidCars,fleeScene:!!first.fleeScene,fled:!!first.fled};
   // A weak driver's tyre (the draw at .9): CTaskComplexLeaveCarAndFlee, out at once and 60 units away for good.
   let evicted=0,firePoint={x:0,z:0};
   traffic.onLeaveCarAndFlee=(c:any)=>{const at=c.car.body.translation();firePoint={x:at.x,z:at.z};evicted+=entry.evictDriver(c,(position:any,heading:number)=>crowd.spawnFleeing(0,position,heading,undefined,{from:{x:at.x,z:at.z},safe:60}))?1:0;};
   traffic.random=()=>.9;other.burstTyre(1,false,'player');
   const left={fled:!!second.fled,evicted,driverOut:other.driverOut,autopilot:!!other.autopilot,fleeScene:!!second.fleeScene};
   let exitFrames=0;for(let i=0;i<300;i++){tick();if(i%20===0)await new Promise(r=>setTimeout(r,40));if(entry.npcPoses().length)exitFrames++;if(exitFrames&&!entry.npcPoses().length&&i>30)break;}
   for(let i=0;i<10;i++){tick();await new Promise(r=>setTimeout(r,40));}
   const runner=crowd.people.find((p:any)=>p.fleePlayer?.point);
   // The player keeps up with him: CPopulation would remove a street ped left 25 units behind out of view.
   watched=runner;
   const runnerStart={flee:runner?.flee??null,safe:runner?.fleePlayer?.safe??null};
   let ended=-1;for(let i=0;i<900;i++){tick();if(runner&&runner.flee<=0){ended=i;break;}}
   const dist=runner?Math.hypot(runner.actor.player.position.x-firePoint.x,runner.actor.player.position.z-firePoint.z):null;
   // A second shot on the same car changes nothing; a ped's bullet on the first car is a neutral-column draw.
   const again=other.burstTyre(2,false,'player');
   return {before,flee,left,exitFrames,runnerStart,ended,dist,again,evicted};
  }finally{crowd.dispose();traffic.dispose();fleet.dispose();sim.dispose();}
 });
 // A street car's cruise is GenerateOneRandomCar's 13 to 20 (21 at rand()'s top), under the flight's 40.
 expect(result.before.avoid).toBe(false);expect(result.before.cruise).toBeLessThanOrEqual(21);
 expect(result.flee).toEqual({burst:true,cruise:40,avoid:true,fleeScene:true,fled:false});
 expect(result.left).toEqual({fled:true,evicted:1,driverOut:true,autopilot:false,fleeScene:false});
 expect(result.exitFrames).toBeGreaterThan(20);
 expect(result.runnerStart.flee).toBeGreaterThan(100);expect(result.runnerStart.safe).toBe(60);
 expect(result.ended).toBeGreaterThanOrEqual(0);expect(result.dist!).toBeGreaterThan(58);
 expect(result.again).toBe(true);expect(result.evicted).toBe(1);
});
