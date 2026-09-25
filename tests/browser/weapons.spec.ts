import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
test('every handheld weapon has a native model, textures and a firing/use animation',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
 const [{openWeaponAssets},{WEAPONS},{modelObject}]=await Promise.all(['/src/weapons/assets.ts','/src/weapons/catalog.ts','/src/assets/ModelObjects.ts'].map(p=>import(p)));
 const catalog=await openWeaponAssets(new URL('/play/world/',location.href).href),success:any[]=[],failures:any[]=[];
 for(const w of WEAPONS){try{const a=await catalog.load(w.id);if(a.asset){const object=modelObject(a.asset.model,a.asset.textures);object.dispose();}success.push({id:w.id,clip:a.clip.name,textures:a.asset?.textures.map((t:any)=>t.name),crosshair:!!a.crosshair});}catch(e){failures.push({id:w.id,name:w.name,error:String(e)});}}
 return {success,failures};});expect(result.failures).toEqual([]);expect(result.success).toHaveLength(44);
 // Only the sniper rifle and camera TXDs carry a CROSSHAIR raster for CHud::DrawCrossHairs.
 expect(result.success.filter((s:any)=>s.crosshair).map((s:any)=>s.id)).toEqual([34,43]);
});

test('arsenal equips every weapon and guns aim, fire, reload when empty, and pause',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 await expect.poll(async()=>(await state()).weapons.ready).toBe(true);
 await page.keyboard.press('Tab');await expect(page.locator('.arsenal')).toBeVisible();
 expect(await page.locator('[data-weapon]').count()).toBe(44);await page.screenshot({path:'artifacts/arsenal.png'});
 const ids=await page.locator('[data-weapon]').evaluateAll(nodes=>nodes.map(n=>Number((n as HTMLElement).dataset.weapon)));
 for(const id of ids){if(!(await state()).weapons.arsenal)await page.keyboard.press('Tab');await page.locator(`[data-weapon="${id}"]`).click();await expect.poll(async()=>(await state()).weapons.error).toBeNull();await expect.poll(async()=>{const s=(await state()).weapons;return s.id===id&&s.ready;},{timeout:10000}).toBe(true);}
 await page.keyboard.press('Tab');await page.locator('[data-weapon="31"]').click();await expect.poll(async()=>(await state()).weapons.ready).toBe(true);
 await page.mouse.move(750,420);await page.mouse.down({button:'right'});await page.mouse.down();
 await expect.poll(async()=>(await state()).weapons.clip).toBeLessThan(49);await page.screenshot({path:'artifacts/weapons-m4.png'});
 // SA has no reload control: CWeapon::Fire reloads when the clip runs out.
 await expect.poll(async()=>(await state()).weapons.reloading,{timeout:20000}).toBeGreaterThan(0);
 await page.mouse.up();await page.mouse.up({button:'right'});
 await expect.poll(async()=>(await state()).nativeCharacter.reload?.name).toBe('rifle_load');await page.waitForTimeout(250);await page.screenshot({path:'artifacts/weapons-reload.png'});
 await page.keyboard.press('Escape');const paused=(await state()).weapons.reloading,pose=(await state()).nativeCharacter.reload;await page.waitForTimeout(200);expect((await state()).weapons.reloading).toBe(paused);expect((await state()).nativeCharacter.reload).toEqual(pose);
 await page.getByRole('button',{name:'Resume game',exact:true}).click();await expect.poll(async()=>(await state()).weapons.clip).toBe(50);await expect.poll(async()=>(await state()).nativeCharacter.reload).toBeNull();
 expect(errors).toEqual([]);
});

test('camera downloads a photo in its first-person mode, vision toggles and sniper scope works',async({page})=>{
 test.setTimeout(120000);await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const equip=async(id:number)=>{await page.keyboard.press('Tab');await page.locator(`[data-weapon="${id}"]`).click();await expect.poll(async()=>(await state()).weapons.ready).toBe(true);};
 // The camera fires only in MODE_CAMERA, entered by holding the target button.
 await equip(43);await page.mouse.move(720,450);await page.mouse.down({button:'right'});await expect.poll(async()=>(await state()).camera.firstPerson).toBe('camera');
 const download=page.waitForEvent('download');await page.keyboard.press('ControlLeft');expect((await download).suggestedFilename()).toMatch(/^San-Andreas-.*\.png$/);
 await page.mouse.up({button:'right'});await expect.poll(async()=>(await state()).camera.firstPerson).toBeNull();
 // The goggles toggle on the fire button's press, once goggles_put_on has played (0.8 s of game time, which runs
 // behind the wall clock on a loaded machine); a tap is held for a few frames so a slow frame cannot miss it.
 const tap=async()=>{await page.keyboard.down('ControlLeft');await page.waitForTimeout(150);await page.keyboard.up('ControlLeft');};
 for(const [id,vision] of [[44,'nightvision'],[45,'infrared']] as const){await equip(id);await page.waitForTimeout(750);await tap();await expect.poll(async()=>(await state()).weapons.vision,{timeout:20000}).toBe(vision);await page.waitForTimeout(1500);await tap();await expect.poll(async()=>(await state()).weapons.vision,{timeout:20000}).toBeNull();}
 await equip(34);await page.mouse.down({button:'right'});await expect(page.locator('.weapon-crosshair.native-scope')).toBeVisible();await page.screenshot({path:'artifacts/weapons-scope.png'});await page.mouse.up({button:'right'});await expect(page.locator('.weapon-crosshair')).toBeHidden();
});

test('native parachute canopy binds, deploys, and limits descent',async({page})=>{
 await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{openWorldPedestrians},{NativeCharacter},{WeaponSystem},{WeaponView},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/assets/worldPedestrians.ts','/src/render/NativeCharacter.ts','/src/weapons/WeaponSystem.ts','/src/weapons/WeaponView.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href,catalog=await openWorldPedestrians(base),owner=new NativeCharacter(catalog.models[0]),scene=new THREE.Scene(),sim=new Simulation();scene.add(owner.root);owner.setAmbient([1,1,1]);
  sim.respawn={x:0,y:20,z:0};sim.resetPlayer();sim.player.grounded=false;sim.player.verticalSpeed=-20;
  const weapons=new WeaponSystem(sim,()=>undefined,()=>undefined),view=new WeaponView(scene,()=>owner,base,weapons);weapons.inventory.select(46);await view.equip(46);
  if(view.error)throw new Error(view.error);weapons.fire({origin:{x:0,y:22,z:2},direction:{x:0,y:0,z:-1}});
  for(let i=0;i<30;i++){weapons.tick(1/60);const controls={x:0,y:0,jump:false,sprint:false,cameraYaw:0,parachute:weapons.parachute};owner.step(1/60,controls,sim);sim.step(1/60,controls);view.update();owner.update(sim,1);}
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(800,600);renderer.setClearColor(0x5688a6);renderer.domElement.id='chute-preview';renderer.domElement.style.cssText='position:fixed;inset:0;z-index:9999';document.body.append(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(45,4/3,.1,100);camera.position.set(10,sim.player.position.y+4,10);camera.lookAt(0,sim.player.position.y+3,0);renderer.render(scene,camera);
  (window as any).__disposeChute=()=>{view.dispose();owner.dispose();sim.dispose();renderer.dispose();};
  return {ready:weapons.ready,deployed:weapons.parachute,vertical:sim.player.verticalSpeed};
 });expect(result).toEqual({ready:true,deployed:true,vertical:-3});await page.locator('#chute-preview').screenshot({path:'artifacts/weapons-parachute.png'});await page.evaluate(()=>(window as any).__disposeChute());
});

test('firearms kill native pedestrians and destroy native cars',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WorldFleet},{WorldTraffic},{WeaponSystem},{Simulation},{loadWorldRoadMaterials},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WorldFleet.ts','/src/simulation/WorldTraffic.ts','/src/weapons/WeaponSystem.ts','/src/simulation/Simulation.ts','/src/assets/worldRoadMaterials.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined),fleet=new WorldFleet(sim,scene,await loadWorldRoadMaterials(base),undefined,base),traffic=new WorldTraffic(sim,fleet,base),weapons=new WeaponSystem(sim,()=>crowd,()=>fleet);
  try{
   for(let i=0;i<300&&(!crowd.targets().length||!fleet.cars.size);i++){crowd.update(i*1600);traffic.update(i*2100);await new Promise(r=>setTimeout(r,20));}sim.world.step();
   const target=crowd.targets()[0];if(!target)throw new Error('No civilian');
   const position=target.position;sim.player.position={x:position.x,y:position.y-1.3,z:position.z+3};sim.playerBody.setTranslation({...sim.player.position,y:position.y},true);sim.world.step();
   weapons.inventory.select(34);weapons.aiming=true;weapons.fire({origin:{x:position.x,y:position.y,z:position.z+3},direction:{x:0,y:0,z:-1}});
   const dead=crowd.snapshot().people.filter((p:any)=>p.state==='dead').length;
   for(let i=0;i<240;i++){crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();}const deadAfter=crowd.snapshot().people.filter((p:any)=>p.state==='dead').length;
   const car=[...fleet.cars][0] as any;if(!car)throw new Error('No vehicle');const p=car.car.body.translation();
   sim.player.position={x:p.x,y:p.y-1.3,z:p.z+10};sim.playerBody.setTranslation({...sim.player.position,y:p.y},true);sim.world.step();weapons.inventory.select(38);
   for(let i=0;i<40&&car.health>1;i++){weapons.tick(.1);weapons.fire({origin:{x:p.x,y:p.y,z:p.z+10},direction:{x:0,y:0,z:-1}});}
   const burning=car.onFire,panels=[...car.damageState.panels];
   // Native cars below 250 health burn for 5000 ms before CAutomobile::BlowUpCar.
   for(let i=0;i<400&&!car.wrecked;i++){car.beforeStep(1/60,{x:0,y:0},true);sim.world.step();car.afterStep();weapons.tick(1/60);}
   const health=car.health;sim.player.position={x:p.x+2,y:p.y,z:p.z};const enter=car.interact();
   return {dead,deadAfter,health,enter,explosions:weapons.explosions,burning,panels};
  }finally{weapons.dispose();traffic.dispose();fleet.dispose();crowd.dispose();sim.dispose();}
 });expect(result.dead).toBe(1);expect(result.deadAfter).toBe(1);expect(result.health).toBe(0);expect(result.burning).toBe(true);expect(result.explosions).toBeGreaterThan(0);expect(result.enter).toBe('This vehicle is destroyed.');
});

test('native reload clips bind and upper-body weapon poses preserve walking legs',async({page})=>{
 await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{openWorldPedestrians},{openWeaponAssets},{WEAPONS},{NativeCharacter},{Simulation},{RAPIER}]=await Promise.all(['/src/assets/worldPedestrians.ts','/src/weapons/assets.ts','/src/weapons/catalog.ts','/src/render/NativeCharacter.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href,catalog=await openWorldPedestrians(base),assets=await openWeaponAssets(base),source=catalog.models[0],armed=new NativeCharacter(source),walking=new NativeCharacter(source),sim=new Simulation(),loaded=[];
  try{
   for(const w of WEAPONS.filter((w:any)=>w.reloadClip)){const a=await assets.load(w.id);armed.installReactions({[w.reloadClip.toLowerCase()]:a.reloadClip},true);loaded.push(w.id);}
   const rifle=await assets.load(31);armed.installReactions({rifle_fire:rifle.clip},true);armed.setWeaponPose('rifle_fire');sim.player.grounded=true;
   const controls={x:0,y:1,walk:true,sprint:false,jump:false,cameraYaw:0};
   const pose=(owner:any,id:number)=>{const index=source.model.frames.findIndex((f:any)=>f.hanim?.id===id);let matrix:number[]=[];owner.root.traverse((o:any)=>{if(o.userData.nativeFrame===index)matrix=o.matrix.elements.slice();});return matrix;};
   const tick=()=>{for(const owner of [armed,walking]){owner.step(1/60,controls,sim);owner.update(sim,1);}};
   for(let i=0;i<20;i++)tick();const firstLeg=pose(armed,42),walkingLeg=pose(walking,42),aimHand=pose(armed,24),plainHand=pose(walking,24);
   armed.setWeaponReload('rifle_load',.25);tick();const reloadA=pose(armed,24);armed.setWeaponReload('rifle_load',.75);tick();const reloadB=pose(armed,24),reloadLeg=pose(armed,42),plainReloadLeg=pose(walking,42);
   armed.setWeaponReload();for(let i=0;i<20;i++)tick();return {loaded,firstLeg,walkingLeg,nextLeg:pose(armed,42),aimHand,plainHand,reloadA,reloadB,reloadLeg,plainReloadLeg,reload:armed.snapshot().reload};
  }finally{armed.dispose();walking.dispose();sim.dispose();}
 });expect(result.loaded).toHaveLength(10);expect(result.firstLeg).toEqual(result.walkingLeg);expect(result.reloadLeg).toEqual(result.plainReloadLeg);expect(result.nextLeg).not.toEqual(result.firstLeg);expect(result.aimHand).not.toEqual(result.plainHand);expect(result.reloadA).not.toEqual(result.reloadB);expect(result.reload).toBeNull();
});

test('knife stealth kills follow the native stealth_kn sequence from behind',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WeaponSystem},{Simulation},{readWeaponData},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/weapons/WeaponSystem.ts','/src/simulation/Simulation.ts','/src/weapons/weaponData.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined),weapons=new WeaponSystem(sim,()=>crowd,()=>undefined);
  weapons.installNative(readWeaponData(new TextDecoder('windows-1252').decode(await (await fetch('/play/world/files/data/weapon.dat')).arrayBuffer())));
  try{
   for(let i=0;i<300&&!crowd.snapshot().people.length;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const victim=crowd.snapshot().people.find((p:any)=>p.state==='walk');if(!victim)throw new Error('No civilian');
   const behind={x:victim.position.x-Math.sin(victim.heading)*1.6,y:victim.position.y,z:victim.position.z-Math.cos(victim.heading)*1.6};
   sim.player.position={...behind};sim.playerBody.setTranslation({...behind,y:behind.y+.9},true);sim.player.grounded=true;sim.player.speed=0;sim.world.step();
   weapons.inventory.select(4);weapons.aiming=true;const front={...behind,z:behind.z+.1};
   const inFront=crowd.stealthTarget({x:victim.position.x+Math.sin(victim.heading)*1.6,y:victim.position.y,z:victim.position.z+Math.cos(victim.heading)*1.6});
   for(let i=0;i<6;i++)weapons.tick(1/60);const ready=weapons.stealthReady;
   const started=weapons.fire({origin:front,direction:{x:0,y:0,z:1}});const during=crowd.snapshot().people.find((p:any)=>p.id===victim.id).state;
   let states:string[]=[];for(let i=0;i<200;i++){weapons.tick(1/60);crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();states.push(crowd.snapshot().people.find((p:any)=>p.id===victim.id).state);}
   const gap=Math.hypot(sim.player.position.x-victim.position.x,sim.player.position.z-victim.position.z);
   return {inFront:!!inFront,ready,started,during,final:states.at(-1),stealthCleared:!weapons.stealth,gap};
  }finally{weapons.dispose();crowd.dispose();sim.dispose();}
 });
 expect(result.inFront).toBe(false);expect(result.ready).toBeGreaterThan(1/16);expect(result.started).toBe(true);expect(result.during).toBe('stealth');expect(result.final).toBe('dead');expect(result.gap).toBeLessThan(1.4);
});
