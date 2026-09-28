import {test,expect} from '@playwright/test';
test('a native cop car chases the player, switches to close pursuit, stops within 10 units and its crew climbs out',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldCar},{loadWorldRoadMaterials},{WorldCar},{Simulation},{WantedSystem},{WorldPolice},{VehicleAnimationLibrary},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldCar.ts','/src/assets/worldRoadMaterials.ts','/src/simulation/WorldCar.ts','/src/simulation/Simulation.ts','/src/simulation/WantedSystem.ts','/src/simulation/WorldPolice.ts','/src/assets/vehicleAnimations.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href,catalog=await openStaticWorldVehicles(await openStaticWorld(base)),road=await loadWorldRoadMaterials(base);
  const sim=new Simulation(),scene=new THREE.Scene();sim.world.createCollider(RAPIER.ColliderDesc.cuboid(300,.5,300).setTranslation(0,-.5,0));sim.world.step();
  sim.respawn={x:0,y:0,z:0};sim.resetPlayer();
  const assets=await loadFixedWorldCar(catalog,{modelId:596,primaryColor:-1,secondaryColor:-1}),car=new WorldCar(sim,scene,assets,{x:0,y:1.2,z:80},road,0);
  const cars=new Set([car]),fleet={cars,removeTrafficCar:()=>{},spawnTrafficCar:async()=>undefined} as any;
  const law=new WantedSystem();law.setLevel(2);
  const clips=new VehicleAnimationLibrary(base);await clips.load(car.animGroup);
  const police=new WorldPolice(sim,fleet,law,clips,base);const officers:any[]=[];police.spawnOfficer=(model:string,weapon:number,position:any)=>officers.push({model,weapon,position});
  police.units.push({car,wanted:2,member:{model:'lapd1',weapon:22},seats:[true,true,false,false],mission:'far',siren:false,cruise:34,slowTimer:0,leaving:[],entering:[],returning:new Map(),stuck:0,recoveryMode:0,lastRecovery:-Infinity,route:[],routeAt:-Infinity,seconds:0,seatHealth:[100,100,100,100],deadSeats:[false,false,false,false]});
  car.autopilot={throttle:0,brake:0,steering:0,handbrake:false};car.activeRadius=250;
  const log:any[]=[];let closeAt:number|undefined,stoppedAt:number|undefined;
  for(let i=0;i<60*30;i++){
   police.beforeStep(1/60);car.beforeStep(1/60,{x:0,y:0},false);sim.world.step();car.afterStep(1/60);law.tick(1/60,true);
   const u=police.units[0],p=car.car.body.translation(),d=Math.hypot(p.x,p.z);
   if(u.mission==='close'&&closeAt===undefined)closeAt=i/60;if(u.mission==='stopped'&&stoppedAt===undefined)stoppedAt=i/60;
   if(i%60===0)log.push({t:i/60,mission:u.mission,d:+d.toFixed(1),speed:+Math.hypot(car.car.body.linvel().x,car.car.body.linvel().z).toFixed(1),crew:u.seats.filter(Boolean).length,leaving:u.leaving.length});
   if(officers.length===2)break;
  }
  const presence=police.presence({x:0,y:1,z:0},18),u=police.units[0];
  return {log,closeAt,stoppedAt,officers,presence,siren:u.siren,finalDistance:Math.hypot(car.car.body.translation().x,car.car.body.translation().z),door:car.doors[2].ratio};
 });
 console.log(JSON.stringify(result));
 expect(result.closeAt).toBeDefined();expect(result.stoppedAt).toBeDefined();expect(result.finalDistance).toBeLessThanOrEqual(12);
 expect(result.officers.map((o:any)=>o.model)).toEqual(['lapd1','lapd1']);expect(result.presence).toBe(0);expect(errors).toEqual([]);
});

test('cops who climbed out run back to their car and drive off when the suspect escapes in another vehicle',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldCar},{loadWorldRoadMaterials},{WorldCar},{Simulation},{WantedSystem},{WorldPolice},{VehicleAnimationLibrary},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldCar.ts','/src/assets/worldRoadMaterials.ts','/src/simulation/WorldCar.ts','/src/simulation/Simulation.ts','/src/simulation/WantedSystem.ts','/src/simulation/WorldPolice.ts','/src/assets/vehicleAnimations.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href,catalog=await openStaticWorldVehicles(await openStaticWorld(base)),road=await loadWorldRoadMaterials(base);
  const sim=new Simulation(),scene=new THREE.Scene();sim.world.createCollider(RAPIER.ColliderDesc.cuboid(300,.5,300).setTranslation(0,-.5,0));sim.world.step();
  sim.respawn={x:0,y:0,z:0};sim.resetPlayer();
  const car=new WorldCar(sim,scene,await loadFixedWorldCar(catalog,{modelId:596,primaryColor:-1,secondaryColor:-1}),{x:0,y:1.2,z:12},road,0);
  const getaway=new WorldCar(sim,scene,await loadFixedWorldCar(catalog,{modelId:492,primaryColor:-1,secondaryColor:-1}),{x:40,y:1.2,z:-40},road,0);
  const fleet={cars:new Set([car,getaway]),removeTrafficCar:()=>{},spawnTrafficCar:async()=>undefined} as any;
  const law=new WantedSystem();law.setLevel(2);
  const clips=new VehicleAnimationLibrary(base);await clips.load(car.animGroup);
  const police=new WorldPolice(sim,fleet,law,clips,base);
  // Stand-in street crew: each officer stands where it climbed out and runs (3.8) or walks (1.2) toward any door point it is sent to.
  let nextId=0;const officers:any[]=[],events:string[]=[];
  police.spawnOfficer=(_model:string,_weapon:number,position:any,_heading:number,crew:any)=>{officers.push({id:nextId++,seat:crew.seat,unit:crew.unit,position:{...position},down:false});events.push(`out:${crew.seat}`);};
  police.crew={list:(unit:object)=>officers.filter(o=>o.unit===unit),goTo:(id:number,point?:any,walk?:boolean)=>{const o=officers.find(o=>o.id===id);if(o)o.goal=point&&{...point,walk};},board:(id:number)=>{const i=officers.findIndex(o=>o.id===id);if(i<0)return false;events.push(`in:${officers[i].seat}`);officers.splice(i,1);return true;}};
  police.units.push({car,wanted:2,member:{model:'lapd1',weapon:22},seats:[true,true,false,false],mission:'far',siren:false,cruise:34,slowTimer:0,leaving:[],entering:[],returning:new Map(),stuck:0,recoveryMode:0,lastRecovery:-Infinity,route:[],routeAt:-Infinity,seconds:0,seatHealth:[100,100,100,100],deadSeats:[false,false,false,false]});
  car.autopilot={throttle:0,brake:0,steering:0,handbrake:false};car.activeRadius=250;getaway.activeRadius=250;
  const u=police.units[0],phases=new Set<string>(),step=(playerCar?:any)=>{
   police.beforeStep(1/60,playerCar);for(const c of fleet.cars)c.beforeStep(1/60,{x:0,y:0},false);sim.world.step();for(const c of fleet.cars)c.afterStep(1/60);law.tick(1/60,true);
   for(const o of officers)if(o.goal){const dx=o.goal.x-o.position.x,dz=o.goal.z-o.position.z,d=Math.hypot(dx,dz),m=Math.min(d,(o.goal.walk?1.2:3.8)/60);if(d>0){o.position.x+=dx/d*m;o.position.z+=dz/d*m;}}
   for(const e of u.entering)phases.add(`${e.seat}:${e.phase}`);
  };
  // On foot beside the car: the crew climbs out.
  for(let i=0;i<60*20&&officers.length<2;i++)step();
  const out={officers:officers.length,seats:[...u.seats],driverOut:car.driverOut};
  // Sitting still in a car right next to them, the suspect is not escaping.
  sim.player.position={...getaway.car.body.translation()};getaway.car.body.setTranslation({x:car.car.body.translation().x+6,y:1.2,z:car.car.body.translation().z},true);
  for(let i=0;i<60;i++)step(getaway);
  const parked={returning:u.returning.size,officers:officers.length};
  // Driving away at 12 m/s.
  let doorOpened=0;
  for(let i=0;i<60*12&&(officers.length||u.entering.length);i++){getaway.car.body.setLinvel({x:12,y:0,z:0},true);step(getaway);doorOpened=Math.max(doorOpened,car.doors[2].ratio);}
  for(let i=0;i<30;i++)step(getaway);
  return {out,parked,events,phases:[...phases],seats:[...u.seats],mission:u.mission,driverOut:car.driverOut,autopilot:!!car.autopilot,doorOpened,doorClosed:car.doors[2].ratio,snapshot:police.snapshot().units[0]};
 });
 console.log(JSON.stringify(result));
 expect(result.out).toEqual({officers:2,seats:[false,false,false,false],driverOut:true});
 expect(result.parked).toEqual({returning:0,officers:2});
 // The driver climbs back in through the door it left open and closes it; the car resumes the chase at once.
 expect(result.events.slice(0,2).sort()).toEqual(['out:0','out:1']);expect(result.events).toContain('in:0');
 expect(result.phases).toEqual(expect.arrayContaining(['0:align','0:getIn','0:closeInside']));
 expect(result.seats[0]).toBe(true);expect(result.driverOut).toBe(false);expect(result.autopilot).toBe(true);expect(['far','close']).toContain(result.mission);
 expect(result.doorOpened).toBeGreaterThan(.9);expect(result.doorClosed).toBe(0);expect(errors).toEqual([]);
});

test('a chasing cop car goes back to cruising when the police back off, though the wanted level stays',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldCar},{loadWorldRoadMaterials},{WorldCar},{Simulation},{WantedSystem},{WorldPolice},{VehicleAnimationLibrary},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldCar.ts','/src/assets/worldRoadMaterials.ts','/src/simulation/WorldCar.ts','/src/simulation/Simulation.ts','/src/simulation/WantedSystem.ts','/src/simulation/WorldPolice.ts','/src/assets/vehicleAnimations.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href,catalog=await openStaticWorldVehicles(await openStaticWorld(base)),road=await loadWorldRoadMaterials(base);
  const sim=new Simulation(),scene=new THREE.Scene();sim.world.createCollider(RAPIER.ColliderDesc.cuboid(300,.5,300).setTranslation(0,-.5,0));sim.world.step();
  sim.respawn={x:0,y:0,z:0};sim.resetPlayer();
  const assets=await loadFixedWorldCar(catalog,{modelId:596,primaryColor:-1,secondaryColor:-1}),car=new WorldCar(sim,scene,assets,{x:0,y:1.2,z:80},road,0);
  const cars=new Set([car]),fleet={cars,removeTrafficCar:()=>{},spawnTrafficCar:async()=>undefined} as any;
  const law=new WantedSystem();law.setLevel(2);
  const clips=new VehicleAnimationLibrary(base);await clips.load(car.animGroup);
  const police=new WorldPolice(sim,fleet,law,clips,base);const officers:any[]=[];police.spawnOfficer=(model:string,weapon:number,position:any)=>officers.push({model,weapon,position});
  police.units.push({car,wanted:2,member:{model:'lapd1',weapon:22},seats:[true,true,false,false],mission:'far',siren:false,cruise:34,slowTimer:0,leaving:[],entering:[],returning:new Map(),stuck:0,recoveryMode:0,lastRecovery:-Infinity,route:[],routeAt:-Infinity,seconds:0,seatHealth:[100,100,100,100],deadSeats:[false,false,false,false]});
  for(let i=0;i<30;i++){police.beforeStep(1/60);car.beforeStep(1/60,{x:0,y:0},false);sim.world.step();car.afterStep(1/60);}
  const chasing=police.units[0].mission;
  law.native.policeBackOff=true;police.beforeStep(1/60);
  const backedOff={mission:police.units[0].mission,level:law.level};
  law.native.policeBackOff=false;police.noPoliceZone=()=>true;police.beforeStep(1/60);
  return {chasing,backedOff,noPolice:police.units[0].mission,brake:car.autopilot?.brake};
 });
 expect(result.chasing).not.toBe('cruise');
 expect(result.backedOff).toEqual({mission:'cruise',level:2});
 expect(result.noPolice).toBe('cruise');expect(result.brake).toBe(1);
});
