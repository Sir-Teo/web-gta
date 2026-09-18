import {test,expect} from '@playwright/test';

test('native civilians load, walk, react to punches and cars, and dispose cleanly',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{openWorldPedestrians},{WorldPedestrians},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/assets/worldPedestrians.ts','/src/simulation/WorldPedestrians.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const catalog=await openWorldPedestrians(new URL('/play/world/',location.href).href);
  const clips=Object.keys(catalog.animations).filter(n=>/fight|punch|ko_|getup/.test(n));
  const sim=new Simulation(),scene=new THREE.Scene();
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(150,.5,150).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const crowd=new WorldPedestrians(sim,scene,new URL('/play/world/',location.href).href,()=>undefined);
  try{
   for(let i=0;i<300&&!crowd.snapshot().people.length;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,25));}
   const initial=crowd.snapshot();if(!initial.people.length)throw new Error(JSON.stringify(initial));
   const tick=(cars:any[]=[])=>{crowd.beforeStep(1/60,cars);sim.world.step();crowd.afterStep();crowd.render(1,[.7,.7,.7],0);};
   for(let i=0;i<60;i++)tick();const walked=crowd.snapshot();
   const first=walked.people[0];sim.player.position={...first.position,z:first.position.z-1.2};sim.player.heading=0;
   sim.player.heading=Math.PI;const behind=crowd.punch();
   for(let i=0;i<42;i++)tick();
   const near=crowd.snapshot().people[0];sim.player.position={...near.position,z:near.position.z-1.2};sim.player.heading=0;
   const wall=sim.world.createCollider(RAPIER.ColliderDesc.cuboid(2,2,.1).setTranslation(near.position.x,near.position.y+1,near.position.z-.6));sim.world.step();
   const throughWall=crowd.punch();sim.world.removeCollider(wall,true);
   for(let i=0;i<42;i++)tick();
   const current=crowd.snapshot().people[0];sim.player.position={...current.position,z:current.position.z-1.2};
   const punched=crowd.punch(),repeat=crowd.punch();tick();const jabbed=crowd.snapshot();
   // 3-hit combo: jab staggers, hook (third) floors. Wait out cooldowns between links.
   for(let i=0;i<35;i++)tick();sim.player.position={...crowd.snapshot().people[0].position,z:crowd.snapshot().people[0].position.z-1.2};sim.player.heading=0;crowd.punch();
   for(let i=0;i<35;i++)tick();sim.player.position={...crowd.snapshot().people[0].position,z:crowd.snapshot().people[0].position.z-1.2};sim.player.heading=0;crowd.punch();
   // Native hit frames land after the swing: the hook connects ~20 ticks later.
   for(let i=0;i<25;i++)tick();const down=crowd.snapshot();
   for(let i=0;i<230;i++)tick();
   const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(800,500);renderer.setClearColor(0x535b58);
   renderer.domElement.id='knockdown-preview';renderer.domElement.style.cssText='position:fixed;inset:0;z-index:99999';document.body.append(renderer.domElement);
   const camera=new THREE.PerspectiveCamera(45,1.6,.1,100),foot=crowd.snapshot().people[0].position;camera.position.set(foot.x+3,foot.y+2,foot.z+4);camera.lookAt(foot.x,foot.y+.4,foot.z);renderer.render(scene,camera);
   (window as any).__disposeKnockdown=()=>renderer.dispose();
   for(let i=0;i<180;i++)tick();const recovered=crowd.snapshot();
   const target=recovered.people[0],carBody=sim.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(target.position.x,target.position.y+.8,target.position.z));
   sim.world.createCollider(RAPIER.ColliderDesc.cuboid(1,.7,2),carBody);carBody.setLinvel({x:0,y:0,z:0},true);
   // A 1500 kg car stub with its handling masses and collision box for the native impact.
   const car={car:{body:carBody},occupied:false,nativeBody:{mass:1500,turnMass:4000,boundsMin:{x:-1,y:-2,z:-.7},boundsMax:{x:1,y:2,z:.7}}};
   crowd.beforeStep(1/60,[car]);const stationary=crowd.snapshot();
   carBody.setTranslation({x:target.position.x,y:target.position.y+.8,z:target.position.z-5},true);carBody.setLinvel({x:0,y:0,z:12},true);
   for(let i=0;i<45&&!['down','dead'].includes(crowd.snapshot().people[0].state);i++)tick([car]);const impact=crowd.snapshot();
   return {clips,initial,walked,behind,throughWall,punched,repeat,jabbed,down,recovered,stationary,impact};
  }finally{crowd.dispose();if(scene.children.length)throw new Error('Pedestrian views leaked');sim.dispose();}
 });

 await page.locator('#knockdown-preview').screenshot({path:'artifacts/street-life-knockdown.png'});
 await page.evaluate(()=>(window as any).__disposeKnockdown());
 expect(result.initial.people.length).toBeGreaterThan(2);
 expect(result.walked.people.some((p:any,i:number)=>Math.hypot(p.position.x-result.initial.people[i].position.x,p.position.z-result.initial.people[i].position.z)>.2)).toBe(true);
 expect(result.behind).toBe(false);expect(result.throughWall).toBe(false);expect(result.stationary.people[0].state).toBe('flee');
  expect(result.punched).toBe(true);expect(result.repeat).toBe(false);expect(['flee','walk'].includes(result.jabbed.people[0].state)).toBe(true);
 expect(result.down.people[0].state).toBe('down');expect(result.recovered.people[0].state).toBe('flee');// The native impact uses the closing speed: a fleeing ped may only be knocked down, a standing one dies.
 expect(['down','dead']).toContain(result.impact.people[0].state);
});

test('Grove Street shows civilians and accepts the punch control, with pause freezing them',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).pedestrians?.people.length??0,{timeout:45000}).toBeGreaterThan(2);
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await page.keyboard.press('KeyR');
 await expect.poll(async()=>(await state()).nativeCharacter.reaction).toBe('fighta_1');
 await page.screenshot({path:'artifacts/street-life-grove.png'});
 await page.keyboard.press('Escape');const paused=(await state()).pedestrians;
 await page.waitForTimeout(300);expect((await state()).pedestrians.people).toEqual(paused.people);
 await page.getByRole('button',{name:'Resume game',exact:true}).click();
 await expect.poll(async()=>(await state()).nativeCharacter.reaction).toBeNull();
 expect((await state()).pedestrians.error).toBeNull();expect(errors).toEqual([]);
});
