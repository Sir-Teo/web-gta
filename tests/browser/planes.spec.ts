import {test,expect} from '@playwright/test';
test('map hangar launches an original plane into the continuous world',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().fleet!==null)).toBe(true);
 await page.keyboard.press('KeyM');await page.getByLabel('Aircraft',{exact:true}).selectOption('476');await page.getByRole('button',{name:'Fly from Verdant Meadows',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().aircraft?.occupied),{timeout:30000}).toBe(true).catch(async error=>{console.log(await page.locator('body').innerText());throw error;});
 await page.screenshot({path:'artifacts/plane-runway.png'});
 const before=await page.evaluate(()=>(window as any).__game.state().aircraft);
 await page.keyboard.down('KeyW');await page.waitForTimeout(6500);await page.keyboard.up('KeyW');
 await page.keyboard.down('ArrowDown');await page.waitForTimeout(1000);await page.keyboard.up('ArrowDown');await page.waitForTimeout(6500);
 const after=await page.evaluate(()=>(window as any).__game.state().aircraft);console.log(JSON.stringify({before,after,state:await page.evaluate(()=>(window as any).__game.state().following)}));
 await page.screenshot({path:'artifacts/plane-flight.png'});
 expect(after.airspeed).toBeGreaterThan(15);expect(after.position.y-before.position.y).toBeGreaterThan(4);expect(after.grounded).toBe(false);
 await page.keyboard.press('KeyG');await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().aircraft.gearUp)).toBe(true);
 await page.keyboard.press('KeyF');expect(await page.evaluate(()=>(window as any).__game.state().aircraft.occupied)).toBe(true);
 await page.keyboard.press('KeyM');await page.getByLabel('Map destination').selectOption('ls-airport');await expect(page.locator('.map-status')).toContainText('Waypoint');
 const paused=await page.evaluate(()=>(window as any).__game.state().aircraft.position);await page.waitForTimeout(300);expect(await page.evaluate(()=>(window as any).__game.state().aircraft.position)).toEqual(paused);
 expect(errors).toEqual([]);
});

test('all hangar aircraft assemble and dispose their original assets',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{WorldPlane,PLAYABLE_PLANES},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/simulation/WorldPlane.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const catalog=await openStaticWorldVehicles(await openStaticWorld(new URL('/play/world/',location.href).href)),sim=new Simulation(),scene=new THREE.Scene(),models=[];
  try{for(const id of Object.keys(PLAYABLE_PLANES)){const assets=await catalog.load(Number(id));const p=new WorldPlane(sim,scene,assets,{x:0,y:100,z:0});p.update(1);models.push(p.snapshot());p.dispose();}return {models,children:scene.children.length};}finally{sim.dispose();}
 });
 expect(result.models).toHaveLength(7);expect(result.children).toBe(0);
});

test('Dodo can land, brake to a stop and exit on clear ground',async({page})=>{
 await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{WorldPlane},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/simulation/WorldPlane.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const c=await openStaticWorldVehicles(await openStaticWorld(new URL('/play/world/',location.href).href)),sim=new Simulation(),scene=new THREE.Scene();
  // Test fixture floor isolates landing dynamics from streaming timing.
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(2000,1,2000).setTranslation(0,-1,0));
  const plane=new WorldPlane(sim,scene,await c.load(593),{x:0,y:20,z:0});sim.player.position={x:0,y:20,z:0};plane.interact();plane.body.setLinvel({x:0,y:0,z:-25},true);
  try{for(let i=0;i<3600;i++){plane.beforeStep(1/60,{throttle:0,pitch:0,roll:0,rudder:0,brake:true});sim.world.step();plane.afterStep();}const landed=plane.snapshot(),message=plane.interact();return {landed,message,occupied:plane.occupied,collider:sim.playerCollider.isEnabled(),gear:plane.toggleGear()};}finally{plane.dispose();sim.dispose();}
 });
 console.log(JSON.stringify(result));expect(result.landed.grounded).toBe(true);expect(Math.hypot(result.landed.velocity.x,result.landed.velocity.z)).toBeLessThan(2);expect(result.occupied).toBe(false);expect(result.collider).toBe(true);expect(result.gear).toContain('fixed');
});

test('original aircraft wheels roll without changing their centers or accumulating render drift',async({page})=>{
 await page.goto('/models.html');
 const results=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{WorldPlane,PLAYABLE_PLANES},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/simulation/WorldPlane.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const c=await openStaticWorldVehicles(await openStaticWorld(new URL('/play/world/',location.href).href)),sim=new Simulation(),scene=new THREE.Scene();
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(100,1,100).setTranslation(0,-1,0));sim.world.step();
  try{const results=[];for(const id of Object.keys(PLAYABLE_PLANES)){
   const plane=new WorldPlane(sim,scene,await c.load(Number(id)),{x:0,y:1,z:0});
   try{
    const wheels:any[]=[];plane.root.traverse((o:any)=>{if(/^wheel_.*_dummy$/.test(o.name))wheels.push(o);});
    const matrices=()=>wheels.map(o=>[...o.matrix.elements]);const before=matrices();
    plane.body.setLinvel({x:0,y:0,z:-12},true);plane.beforeStep(1/60,{throttle:0,pitch:0,roll:0,rudder:0,brake:false});plane.update(1);
    const after=matrices();plane.update(1);const repeated=matrices();plane.update(0);const previous=matrices();
    results.push({id,before,after,repeated,previous});
   }finally{plane.dispose();}
  }return results;}finally{sim.dispose();}
 });
 expect(results).toHaveLength(7);
 for(const result of results){
  expect(result.before.length,`model ${result.id} wheel frames`).toBeGreaterThan(0);
  expect(result.after).not.toEqual(result.before);expect(result.repeated).toEqual(result.after);expect(result.previous).toEqual(result.before);
  result.after.forEach((matrix:number[],i:number)=>expect(matrix.slice(12,15)).toEqual(result.before[i].slice(12,15)));
 }
});
