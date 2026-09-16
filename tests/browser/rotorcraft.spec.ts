import {test,expect} from '@playwright/test';
test('Maverick takes off vertically, hovers, and pauses through real controls',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});await page.keyboard.press('KeyM');await page.getByLabel('Aircraft',{exact:true}).selectOption('487');await page.getByRole('button',{name:'Fly from Verdant Meadows',exact:true}).click();const state=()=>page.evaluate(()=>(window as any).__game.state());await expect.poll(async()=>(await state()).aircraft?.occupied,{timeout:30000}).toBe(true);const start=(await state()).aircraft.position.y;await page.keyboard.down('KeyW');await page.waitForTimeout(4000);await page.keyboard.up('KeyW');await expect.poll(async()=>(await state()).aircraft.position.y).toBeGreaterThan(start+3);await page.keyboard.down('Space');await page.waitForTimeout(1500);expect(Math.abs((await state()).aircraft.velocity.y)).toBeLessThan(1);await page.screenshot({path:'artifacts/helicopter-hover.png'});await page.keyboard.up('Space');await page.keyboard.press('Escape');const p=(await state()).aircraft.position;await page.waitForTimeout(250);expect((await state()).aircraft.position).toEqual(p);expect(errors).toEqual([]);
});
test('Hydra switches VTOL and mounted weapons consume ammo without hitting their own aircraft',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
 const [{openStaticWorld},{openStaticWorldVehicles},{WorldPlane},{Simulation},{WeaponSystem},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/simulation/WorldPlane.ts','/src/simulation/Simulation.ts','/src/weapons/WeaponSystem.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
 await RAPIER.init();const c=await openStaticWorldVehicles(await openStaticWorld(new URL('/play/world/',location.href).href)),sim=new Simulation(),scene=new THREE.Scene(),plane=new WorldPlane(sim,scene,await c.load(520),{x:0,y:100,z:0});sim.player.position={x:0,y:100,z:0};plane.interact();sim.world.step();const weapons=new WeaponSystem(sim,()=>undefined,()=>({cars:[],planes:new Set([plane])}));
 try{const start=plane.vtol;plane.toggleVtol();const forward=plane.vtol;plane.toggleVtol();const gun=weapons.fireAircraft(plane);weapons.tick(.2);const rocket=weapons.fireAircraft(plane,true);for(let i=0;i<60;i++)weapons.tick(1/60);return {start,forward,gun,rocket,health:plane.health,ammo:plane.gunAmmo,rockets:plane.rockets,projectiles:weapons.projectiles.length};}finally{weapons.dispose();plane.dispose();sim.dispose();}
 });expect(result).toEqual({start:true,forward:false,gun:true,rocket:true,health:800,ammo:1999,rockets:19,projectiles:1});
});
test('bailing out mid-flight with the parachute glides down softly',async({page})=>{
 await page.goto('/models.html');const result=await page.evaluate(async()=>{
 const [{openStaticWorld},{openStaticWorldVehicles},{WorldPlane},{Simulation},{WeaponSystem},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/simulation/WorldPlane.ts','/src/simulation/Simulation.ts','/src/weapons/WeaponSystem.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
 await RAPIER.init();const c=await openStaticWorldVehicles(await openStaticWorld(new URL('/play/world/',location.href).href)),sim=new Simulation(),scene=new THREE.Scene(),plane=new WorldPlane(sim,scene,await c.load(487),{x:0,y:40,z:0});
 sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,1,200).setTranslation(0,-1,0));sim.player.position={x:0,y:40,z:0};plane.interact();
 const weapons=new WeaponSystem(sim,()=>undefined,()=>({cars:[],planes:new Set([plane])}));weapons.parachute=true;
 try{
  plane.body.setLinvel({x:0,y:0,z:12},true);
  for(let i=0;i<10;i++){plane.beforeStep(1/60,{throttle:.5,pitch:0,roll:0,rudder:0,brake:false});sim.world.step();plane.afterStep();}
  const airborne=!plane.grounded;
  const message=plane.exitAir();
  const start={...sim.player.position};
  for(let i=0;i<600;i++){weapons.tick(1/60);sim.step(1/60,{x:0,y:-1,cameraYaw:0,sprint:false,jump:false,parachute:weapons.parachute});sim.world.step();}
  return {airborne,message,occupied:plane.occupied,glide:Math.hypot(sim.player.position.x-start.x,sim.player.position.z-start.z),fall:sim.player.verticalSpeed,health:sim.player.health,collider:sim.playerCollider.isEnabled()};
 }finally{weapons.dispose();plane.dispose();sim.dispose();}
 });
 expect(result.airborne).toBe(true);expect(result.message).toBe('Parachute away');expect(result.occupied).toBe(false);
 expect(result.glide).toBeGreaterThan(3);expect(result.fall).toBeGreaterThanOrEqual(-3.01);expect(result.health).toBe(100);expect(result.collider).toBe(true);
});
test('a hard aircraft impact destroys the aircraft and restores player collision',async({page})=>{
 await page.goto('/models.html');const result=await page.evaluate(async()=>{
 const [{openStaticWorld},{openStaticWorldVehicles},{WorldPlane},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/simulation/WorldPlane.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
 await RAPIER.init();const c=await openStaticWorldVehicles(await openStaticWorld(new URL('/play/world/',location.href).href)),sim=new Simulation(),plane=new WorldPlane(sim,new THREE.Scene(),await c.load(487),{x:0,y:15,z:0});
 sim.world.createCollider(RAPIER.ColliderDesc.cuboid(100,1,100).setTranslation(0,-1,0));sim.player.position={x:0,y:15,z:0};plane.interact();plane.body.setLinvel({x:0,y:-65,z:0},true);
 try{let destroyed=false;for(let i=0;i<120&&!destroyed;i++){plane.beforeStep(1/60,{throttle:0,pitch:0,roll:0,rudder:0,brake:false});sim.world.step();destroyed=plane.afterStep();}const occupied=plane.occupied,health=plane.health,collider=sim.playerCollider.isEnabled();sim.player.health=100;return {destroyed,occupied,health,collider,entry:plane.interact()};}finally{plane.dispose();sim.dispose();}
 });expect(result).toEqual({destroyed:true,occupied:false,health:0,collider:true,entry:'This aircraft is destroyed.'});
});
test('amphibious helicopters float on native water while other rotorcraft drown',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
 const [{openStaticWorld},{openStaticWorldVehicles},{WorldPlane},{Simulation},{WaterLevelIndex},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/simulation/WorldPlane.ts','/src/simulation/Simulation.ts','/src/world/waterLevel.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
 await RAPIER.init();const c=await openStaticWorldVehicles(await openStaticWorld(new URL('/play/world/',location.href).href)),vertex=(x:number,y:number)=>({position:[x,y,0],flow:[0,0],bigWaves:0,smallWaves:0});
 const water=new WaterLevelIndex([{vertices:[vertex(-500,-500),vertex(500,-500),vertex(-500,500),vertex(500,500)],flags:1,line:1}]),runs:any={};
 for(const id of [447,417,487]){
  const sim=new Simulation();sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,1,200).setTranslation(0,-41,0));
  const plane=new WorldPlane(sim,new THREE.Scene(),await c.load(id),{x:0,y:3,z:0});plane.waterLevel=(x:number,y:number)=>water.level(x,y);sim.player.position={x:0,y:3,z:0};plane.interact();
  try{let lowest=Infinity,spray=0,reports=0;for(let i=0;i<900;i++){plane.beforeStep(1/60,{throttle:0,pitch:0,roll:0,rudder:0,brake:false});sim.world.step();plane.afterStep();lowest=Math.min(lowest,plane.body.translation().y);spray+=plane.splashes.length;plane.splashes.length=0;if(plane.splashReport){reports++;plane.splashReport=undefined;}}runs[id]={...plane.snapshot(),lowest,y:plane.body.translation().y,spray,reports};}finally{plane.dispose();sim.dispose();}
 }
 return runs;
 });
 for(const id of ['447','417']){expect(result[id].inWater).toBe(true);expect(result[id].drowning).toBe(false);expect(result[id].y).toBeGreaterThan(-3);expect(Math.abs(result[id].velocity.y)).toBeLessThan(1);}
 expect(result['487'].drowning||result['487'].y<-8).toBe(true);expect(result['487'].y).toBeLessThan(result['447'].y);
 // cBuoyancy::AddSplashParticles: spray and a reported splash need the water line in the upper half of the bounds at over 0.05 units per frame.
 // The Seasparrow rides high with its water line in the lower half and stays dry; the sinking Maverick throws water.
 expect(result['447'].spray).toBe(0);expect(result['487'].spray).toBeGreaterThan(0);expect(result['487'].reports).toBeGreaterThan(0);
});
