import {test,expect} from '@playwright/test';

test('a traffic driver leaves his burning car and flees it 15 units; gang bystanders flee too, civilians stay',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{WorldTraffic},{WorldFleet},{WorldPedestrians},{WantedSystem},{CarEntry},{VehicleAnimationLibrary},{Simulation},{loadWorldRoadMaterials},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldTraffic.ts','/src/simulation/WorldFleet.ts','/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/CarEntry.ts','/src/assets/vehicleAnimations.ts','/src/simulation/Simulation.ts','/src/assets/worldRoadMaterials.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(700,.5,700).setTranslation(2490,12,1680));sim.respawn={x:2495,y:12.55,z:1687};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const fleet=new WorldFleet(sim,scene,await loadWorldRoadMaterials(base),undefined,base),traffic=new WorldTraffic(sim,fleet,base);
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined,new WantedSystem()) as any;
  crowd.pedTargets=()=>({dealers:0,gangs:0,cops:0,other:4,gangStrengths:Array(10).fill(0)});
  const entry=new CarEntry(sim,new VehicleAnimationLibrary(base));
  try{
   for(let i=0;i<300&&(!traffic.snapshot().cars.length||crowd.snapshot().people.length<2);i++){traffic.update(i*2100);crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   if(!fleet.cars.size)throw new Error(JSON.stringify(traffic.snapshot()));
   const car=[...fleet.cars][0] as any;await entry.clips.load(car.animGroup);
   const tick=()=>{const at=car.car.body.translation();sim.player.position={x:at.x+10,y:at.y,z:at.z+10};traffic.beforeStep(1/60);entry.step(1/60,{pedal:false,moving:false});crowd.beforeStep(1/60,[...fleet.cars]);for(const c of fleet.cars)c.beforeStep(1/60,{x:0,y:0},false);sim.world.step();for(const c of fleet.cars)c.afterStep(1/60);crowd.afterStep();};
   for(let i=0;i<120;i++)tick();
   // Two bystanders 6 m from where the car will stop: a gang member and a plain civilian.
   const [gangster,civilian]=crowd.people.filter((p:any)=>!p.officer&&p.health>0);
   const stand=(p:any,x:number,z:number)=>{p.actor.player.position={x,y:12.55,z};p.loiter=true;p.flee=0;p.fleePlayer=undefined;p.body.setTranslation({x,y:13.45,z},true);p.body.setNextKinematicTranslation({x,y:13.45,z});p.collider.setTranslation({x,y:13.45,z});};
   gangster.gang=1;civilian.gang=undefined;
   let evicted=0,immediate:any=null,firePoint={x:0,z:0};const fired:number[]=[];
   traffic.onFire=(c:any)=>{fired.push(c.car.body.handle);const at=c.car.body.translation();firePoint={x:at.x,z:at.z};stand(gangster,at.x+6,at.z);stand(civilian,at.x-6,at.z);
    evicted+=entry.evictDriver(c,(position:any,heading:number)=>crowd.spawnFleeing(0,position,heading,undefined,{from:{x:at.x,z:at.z},safe:15}))?1:0;crowd.vehicleOnFire({x:at.x,z:at.z});immediate={gangFlee:gangster.flee,gangSafe:gangster.fleePlayer?.safe??null,civFlee:civilian.flee};};
   const before={fired:fired.length,driverOut:car.driverOut,autopilot:!!car.autopilot,people:crowd.people.length};
   car.health=200;
   let exitFrames=0,exitClip:string|null=null;
   for(let i=0;i<240;i++){tick();const poses=entry.npcPoses();if(poses.length){exitFrames++;exitClip=poses[0].clip.key;}if(exitFrames&&!poses.length&&i>30)break;}
   const during={fired:fired.length,evicted,driverOut:car.driverOut,autopilot:!!car.autopilot,exitFrames,exitClip,speed:Math.hypot(car.car.body.linvel().x,car.car.body.linvel().z)};
   for(let i=0;i<30;i++)tick();
   const driver=crowd.people.find((p:any)=>p!==gangster&&p!==civilian&&p.fleePlayer?.point);
   const dist=(p:any)=>Math.hypot(p.actor.player.position.x-firePoint.x,p.actor.player.position.z-firePoint.z);
   const start={driver:driver?dist(driver):null,flee:driver?.flee??null,safe:driver?.fleePlayer?.safe??null,civFlee:civilian.flee};
   let driverFleeEnded=-1;
   for(let i=0;i<600;i++){tick();if(driver&&driver.flee<=0&&driverFleeEnded<0)driverFleeEnded=i;if(driverFleeEnded>=0&&gangster.flee<=0)break;}
   const end={driver:driver?dist(driver):null,gang:dist(gangster),gangFlee:gangster.flee,civ:dist(civilian),driverFleeEnded};
   return {before,during,start,end,immediate,fired:fired.length};
  }finally{entry.dispose?.();crowd.dispose();traffic.dispose();fleet.dispose();sim.dispose();}
 });
 expect(result.before).toEqual({fired:0,driverOut:false,autopilot:true,people:result.before.people});
 // The fire is reported once; the driver's car stops and he plays his get-out clip.
 expect(result.during.fired).toBe(1);expect(result.fired).toBe(1);expect(result.during.evicted).toBe(1);
 expect(result.during.driverOut).toBe(true);expect(result.during.autopilot).toBe(false);
 expect(result.during.exitFrames).toBeGreaterThan(20);expect(result.during.exitClip?.toLowerCase()).toContain('getout');
 expect(result.during.speed).toBeLessThan(0.5);
 // He appears at the door fleeing the car (15 units safe), the gang member flees too, the civilian stays put.
 expect(result.start.driver).not.toBeNull();expect(result.start.driver!).toBeLessThan(6);
 expect(result.start.flee).toBeGreaterThan(100);expect(result.start.safe).toBe(15);
 expect(result.immediate.gangFlee).toBeGreaterThan(100);expect(result.immediate.gangSafe).toBe(15);expect(result.immediate.civFlee).toBe(0);expect(result.start.civFlee).toBe(0);
 // Both run past 15 units and stop fleeing there; the civilian has not moved.
 expect(result.end.driverFleeEnded).toBeGreaterThanOrEqual(0);expect(result.end.driver!).toBeGreaterThan(14);
 expect(result.end.gangFlee).toBe(0);expect(result.end.gang).toBeGreaterThan(14);
 expect(Math.abs(result.end.civ-6)).toBeLessThan(1);
});
