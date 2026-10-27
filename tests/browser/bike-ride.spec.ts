import {test,expect} from '@playwright/test';

test('a BMX pedals, steers with lean, poses the rider and knocks off on impact',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldBike},{WorldBike},{Simulation},{THREE,RAPIER},{VehicleAnimationLibrary}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldBike.ts','/src/simulation/WorldBike.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts','/src/assets/vehicleAnimations.ts'].map(p=>import(p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href;
  const catalog=await openStaticWorldVehicles(await openStaticWorld(base));
  const clips=new VehicleAnimationLibrary(base);await clips.block('bmx');WorldBike.hopClipSeconds=()=>clips.peek('bmx','bmx_bunnyhop')?.duration;
  const sim=new Simulation(),scene=new THREE.Scene();
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(0,-.5,0));
  sim.respawn={x:1.5,y:.55,z:2};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const bike=new WorldBike(sim,scene,await loadFixedWorldBike(catalog,{modelId:481,primaryColor:-1,secondaryColor:-1}),{x:0,y:1.5,z:0},0);
  const out:Record<string,unknown>={};
  try{
   const tick=(input?:{throttle:number;steer:number;brake:boolean})=>{bike.beforeStep(1/60,input);sim.world.step();bike.afterStep();bike.update(1);};
   for(let i=0;i<30;i++)tick();
   out.entered=bike.interact();
   out.occupied=bike.snapshot().occupied;
   for(let i=0;i<120;i++)tick({throttle:1,steer:0,brake:false});
   out.movedZ=bike.snapshot().position.z;
   out.speed=bike.snapshot().speed;
   out.headingBefore=bike.snapshot().heading;
   const pose=bike.riderPose();
   out.idle=pose.idle;out.seat=!!pose.seat;out.block=pose.block;
   for(let i=0;i<120;i++)tick({throttle:.5,steer:1,brake:false});
   out.heading=bike.snapshot().heading;
   out.lean=bike.snapshot().lean;
   out.overlay=bike.riderPose().overlay;
   // CBmx::ProcessBunnyHop: half a second held charges the hop fully, and letting go launches it.
   for(let i=0;i<30;i++)tick({throttle:0,steer:0,brake:false,hop:true} as any);
   let hopVy=0;for(let i=0;i<40;i++){tick({throttle:0,steer:0,brake:false});hopVy=Math.max(hopVy,bike.body.linvel().y);}
   out.hopVy=hopVy;
   out.hopCleared=bike.riderPose().hop===undefined&&bike.controlJump===0;
   // A wall stop at speed knocks the rider off through the force formula.
   sim.world.createCollider(RAPIER.ColliderDesc.cuboid(5,3,.5).setTranslation(0,3,-40));
   // A rider the script keeps on (SET_CHAR_CAN_BE_KNOCKED_OFF_BIKE) rides the same crash out.
   WorldBike.riderStaysOn=()=>true;
   bike.body.setTranslation({x:0,y:1.5,z:-20},true);bike.body.setRotation({x:0,y:0,z:0,w:1},true);bike.body.setLinvel({x:0,y:0,z:-30},true);
   for(let i=0;i<120&&bike.snapshot().occupied;i++)tick({throttle:0,steer:0,brake:false});
   out.keptOn=bike.snapshot().occupied;WorldBike.riderStaysOn=undefined;WorldBike.onKnockedOff=(clip:string)=>{out.clip=clip;out.thrown=Math.hypot(sim.collisionPush.x,sim.collisionPush.z);out.rising=sim.player.verticalSpeed;out.airborne=!sim.player.grounded;};
   bike.body.setTranslation({x:0,y:1.5,z:-20},true);bike.body.setRotation({x:0,y:0,z:0,w:1},true);bike.body.setLinvel({x:0,y:0,z:-30},true);bike.body.setAngvel({x:0,y:0,z:0},true);
   for(let i=0;i<120&&bike.snapshot().occupied;i++)tick({throttle:0,steer:0,brake:false});
   out.knocked=!bike.snapshot().occupied;
   out.knockMessage=bike.message;
   return out;
  }finally{bike.dispose();sim.dispose();}
 });
 expect(result.entered).toMatch(/BMX/);
 expect(result.occupied).toBe(true);
 expect(result.movedZ).toBeLessThan(-2);
 // A full charge is 0.06 x 2 units a frame up: 6 m/s.
 expect(result.hopVy).toBeGreaterThan(4);
 expect(result.hopCleared).toBe(true);
 expect(result.speed).toBeGreaterThan(2);
 expect(result.idle).toBe('bmx_pedal');
 expect(result.seat).toBe(true);
 expect(result.block).toBe('bmx');
 expect(result.headingBefore).toBeDefined();
 expect(Math.abs((result.heading as number)-(result.headingBefore as number))).toBeGreaterThan(.05);
 expect(result.lean).toBeGreaterThan(.02);
 expect(result.overlay).toMatchObject({clip:'bmx_right'});
 expect(result.keptOn).toBe(true);
 expect(result.knocked).toBe(true);
 expect(result.knockMessage).toBe('Knocked off the bike!');
 // CEventKnockOffBike (SKIDBACKFRONT): a head-on stop throws the rider forward, lifted, with KO_SKID_BACK.
 expect(result.clip).toBe('ko_skid_back');
 expect(result.thrown).toBeGreaterThan(2);
 expect(result.rising).toBeGreaterThan(2);
 expect(result.airborne).toBe(true);
 expect(errors).toEqual([]);
});

test('a quad keeps its body level and leans only the rider into the turn',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldBike},{WorldBike},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldBike.ts','/src/simulation/WorldBike.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href;
  const catalog=await openStaticWorldVehicles(await openStaticWorld(base));
  const sim=new Simulation(),scene=new THREE.Scene();
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(0,-.5,0));
  sim.respawn={x:1.5,y:.55,z:2};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const quad=new WorldBike(sim,scene,await loadFixedWorldBike(catalog,{modelId:471,primaryColor:-1,secondaryColor:-1}),{x:0,y:1.5,z:0},0);
  try{
   const tick=(input?:{throttle:number;steer:number;brake:boolean})=>{quad.beforeStep(1/60,input);sim.world.step();quad.afterStep();quad.update(1);};
   for(let i=0;i<30;i++)tick();quad.interact();
   for(let i=0;i<60;i++)tick({throttle:1,steer:0,brake:false});
   for(let i=0;i<60;i++)tick({throttle:.5,steer:1,brake:false});
   return {lean:quad.snapshot().lean,rider:quad.riderLean,overlay:quad.riderPose().overlay};
  }finally{quad.dispose();sim.dispose();}
 });
 expect(result.lean).toBe(0);
 expect(result.rider).toBeGreaterThan(.7);
 expect(result.overlay?.clip).toBe('quad_right');expect(result.overlay?.amount).toBeGreaterThan(.95);
 expect(errors).toEqual([]);
});

test('a bike under water drowns: CJ loses breath on the bottom and falls off once no wheel touches it',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldBike},{WorldBike},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldBike.ts','/src/simulation/WorldBike.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href;
  const catalog=await openStaticWorldVehicles(await openStaticWorld(base));
  const sim=new Simulation(),scene=new THREE.Scene();
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(0,-.5,0));
  sim.respawn={x:1.5,y:.55,z:2};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const bike=new WorldBike(sim,scene,await loadFixedWorldBike(catalog,{modelId:481,primaryColor:-1,secondaryColor:-1}),{x:0,y:1.5,z:0},0);
  try{
   const tick=()=>{bike.beforeStep(1/60,{throttle:0,steer:0,brake:false});sim.world.step();bike.afterStep();bike.update(1);};
   for(let i=0;i<30;i++)tick();bike.interact();
   // Three units of water over the floor: the bike drowns with its wheels down, and CJ holds his breath on it.
   const initialBreath=sim.player.breath;bike.waterLevel=()=>3;
   for(let i=0;i<60;i++)tick();
   const bottom={drowning:bike.drowning,occupied:bike.snapshot().occupied,breath:sim.player.breath};
   // Off the floor's edge in open water: no wheel touches, and he drops off (KNOCK_OFF_TYPE_FALL).
   bike.body.setTranslation({x:400,y:5,z:0},true);bike.body.setLinvel({x:0,y:0,z:0},true);bike.waterLevel=()=>8;
   for(let i=0;i<5&&bike.snapshot().occupied;i++)tick();
   return {bottom,initialBreath,thrown:!bike.snapshot().occupied,airborne:!sim.player.grounded};
  }finally{bike.dispose();sim.dispose();}
 });
 expect(result.bottom.drowning).toBe(true);
 expect(result.bottom.occupied).toBe(true);
 expect(result.initialBreath-result.bottom.breath).toBeCloseTo(50,6);
 expect(result.thrown).toBe(true);
 expect(result.airborne).toBe(true);
 expect(errors).toEqual([]);
});

test('a bike rolling over 0.2 units a frame cannot be boarded (CTaskComplexEnterCar gives up)',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldBike},{WorldBike},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldBike.ts','/src/simulation/WorldBike.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href;
  const catalog=await openStaticWorldVehicles(await openStaticWorld(base));
  const sim=new Simulation(),scene=new THREE.Scene();
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(0,-.5,0));
  sim.respawn={x:1.5,y:.55,z:2};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const bike=new WorldBike(sim,scene,await loadFixedWorldBike(catalog,{modelId:481,primaryColor:-1,secondaryColor:-1}),{x:0,y:1.5,z:0},0);
  try{
   const still=bike.enterCheck();bike.body.setLinvel({x:0,y:0,z:-12},true);const rolling=bike.enterCheck();
   return {still,rolling};
  }finally{bike.dispose();sim.dispose();}
 });
 expect(result.still).toBe('');expect(result.rolling).toMatch(/too fast/);
});

test('in the air a BMX spins with the stick up to 0.04 rad a step, and a motorbike does not steer',async({page})=>{
 test.setTimeout(180000);
 await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldBike},{WorldBike},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldBike.ts','/src/simulation/WorldBike.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href;
  const catalog=await openStaticWorldVehicles(await openStaticWorld(base));
  const out:Record<string,number>={};
  for(const modelId of [481,468]){
   const sim=new Simulation(),scene=new THREE.Scene();
   sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(0,-.5,0));
   sim.respawn={x:1.5,y:.55,z:2};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
   const bike=new WorldBike(sim,scene,await loadFixedWorldBike(catalog,{modelId,primaryColor:-1,secondaryColor:-1}),{x:0,y:1.5,z:0},0);
   try{
    const tick=(input?:{throttle:number;steer:number;brake:boolean})=>{bike.beforeStep(1/60,input);sim.world.step();bike.afterStep();bike.update(1);};
    for(let i=0;i<30;i++)tick();bike.interact();
    // Lifted well clear of the ground, moving forward, not turning.
    bike.body.setTranslation({x:0,y:60,z:0},true);bike.body.setLinvel({x:0,y:0,z:-8},true);bike.body.setAngvel({x:0,y:0,z:0},true);
    let fastest=0;for(let i=0;i<45;i++){tick({throttle:0,steer:1,brake:false});fastest=Math.min(fastest,bike.body.angvel().y);}
    out[`spin${modelId}`]=bike.body.angvel().y;out[`fastest${modelId}`]=fastest;
   }finally{bike.dispose();sim.dispose();}
  }
  return out;
 });
 // The BMX turns right (negative yaw) toward 0.04 rad a step, 2 rad/s, and no faster.
 expect(result.spin481).toBeLessThan(-1.5);expect(result.fastest481).toBeGreaterThan(-2.2);
 // A Sanchez in the air keeps the spin it had: none.
 expect(Math.abs(result.spin468)).toBeLessThan(.1);
});
