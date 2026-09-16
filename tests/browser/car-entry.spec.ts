import {test,expect} from '@playwright/test';
/** Harness: a Greenwood on a flat pad with the native entry sequence driven by fixed 1/60 s steps. */
const harness=async()=>{
 const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldCar},{loadWorldRoadMaterials},{WorldCar},{Simulation},{CarEntry},{VehicleAnimationLibrary},{openWorldPedestrians},{NativeCharacter},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldCar.ts','/src/assets/worldRoadMaterials.ts','/src/simulation/WorldCar.ts','/src/simulation/Simulation.ts','/src/simulation/CarEntry.ts','/src/assets/vehicleAnimations.ts','/src/assets/worldPedestrians.ts','/src/render/NativeCharacter.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
 await RAPIER.init();const base=new URL('/play/world/',location.href).href,catalog=await openStaticWorldVehicles(await openStaticWorld(base)),road=await loadWorldRoadMaterials(base),peds=await openWorldPedestrians(base);
 const sim=new Simulation(),scene=new THREE.Scene();sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(0,-.5,0));sim.world.step();
 const assets=await loadFixedWorldCar(catalog,{modelId:492,primaryColor:53,secondaryColor:0}),car=new WorldCar(sim,scene,assets,{x:0,y:1.2,z:0},road);car.setLighting([1,1,1],[1,1,1],1,0);
 const player=new NativeCharacter(peds.models[0]);player.setAmbient([1,1,1]);scene.add(player.root);
 const entry=new CarEntry(sim,new VehicleAnimationLibrary(base));await entry.clips.load(car.animGroup);
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(900,650);renderer.setClearColor(0x717b80);renderer.domElement.id='entry-preview';renderer.domElement.style.cssText='position:fixed;inset:0;z-index:9999';document.body.append(renderer.domElement);
 const camera=new THREE.PerspectiveCamera(40,900/650,.1,100);scene.add(new THREE.AmbientLight(0xffffff,1));
 const reset=(x:number,z:number)=>{sim.respawn={x,y:0,z};sim.resetPlayer();sim.player.heading=Math.PI;};
 const step=(input:{axes?:{x:number;y:number};pedal?:boolean;moving?:boolean;handbrake?:boolean}={})=>{
  const axes=input.axes??{x:0,y:0};let controls={x:0,y:0,cameraYaw:0,jump:false,sprint:false,walk:false};
  if(entry.phase==='approach')controls=entry.approach(1/60,controls,{x:axes.x,y:axes.y,quit:false});
  const motion=entry.step(1/60,{pedal:!!input.pedal,moving:!!input.moving});
  car.beforeStep(1/60,input.pedal?{x:axes.x,y:1}:axes,!!input.handbrake);
  if(car.occupied||entry.pinned)sim.world.step();
  else if(entry.rolling)sim.step(1/60,{...controls,animationMotion:motion??{x:0,z:0},animationMotionSpace:'world'});
  else{const animated=player.step(1/60,controls,sim);sim.step(1/60,animated);}
  car.afterStep(1/60);entry.syncPlayer();
 };
 const render=(eye:[number,number,number],target:[number,number,number])=>{
  car.car.update(1);const clips=entry.requiredClips();if(clips)player.installVehicleClips(clips,['car_rollout_lhs','car_rollout_rhs']);
  const pose=entry.pose();
  if(pose&&player.hasVehicleClip(pose.clip))player.updateVehicle(pose.car?{vehicle:pose.car.car.root,local:pose.local,headingOffset:pose.headingOffset}:{position:{x:sim.player.position.x,y:sim.player.position.y+1,z:sim.player.position.z},heading:pose.heading},pose);
  else player.update(sim,1);
  camera.position.set(...eye);camera.lookAt(...target);renderer.render(scene,camera);
 };
 return {sim,car,entry,player,step,render,reset,dispose(){car.dispose();player.dispose();sim.dispose();renderer.dispose();renderer.domElement.remove();}};
};
test('the player walks to the driver door and plays the native entry and exit sequence with animated doors',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 await page.evaluate(`(${harness.toString()})().then(h=>{window.__entry=h;})`);await page.waitForFunction(()=>!!(window as any).__entry,undefined,{timeout:120000});
 const run=await page.evaluate(()=>{
  const h=(window as any).__entry;h.reset(-4,1);h.entry.enter(h.car);
  const phases:string[]=[],doors:{phase:string;ratio:number}[]=[];let closedDoor=Infinity;
  for(let i=0;i<60*12&&!h.entry.seated;i++){h.step();const phase=h.entry.phase;if(phases.at(-1)!==phase)phases.push(phase);doors.push({phase,ratio:h.car.doors[2].ratio});}
  return {phases,maxOpen:Math.max(...doors.map((d:any)=>d.ratio)),closedAfter:doors.at(-1)?.ratio,occupied:h.car.occupied,collider:h.sim.playerCollider.isEnabled(),side:h.entry.side,closedDoor};
 });
 console.log(JSON.stringify(run));
 expect(run.phases).toEqual(['approach','align','open','getIn','closeInside','seated']);expect(run.maxOpen).toBe(1);expect(run.closedAfter).toBe(0);expect(run.occupied).toBe(true);expect(run.collider).toBe(false);
 // Mid-entry pose: rerun to the open phase and capture the door and the character.
 const exit=await page.evaluate(()=>{
  const h=(window as any).__entry;for(let i=0;i<30;i++)h.step();h.entry.exit();const phases:string[]=[];let doorOpened=0;
  for(let i=0;i<60*4&&h.entry.active;i++){h.step();const phase=h.entry.phase??'none';if(phases.at(-1)!==phase)phases.push(phase);doorOpened=Math.max(doorOpened,h.car.doors[2].ratio);if(phase==='closeOutside'&&h.entry.time<.02)h.render([-5,2.2,2.5],[0,.8,0]);}
  return {phases,doorOpened,door:h.car.doors[2].ratio,occupied:h.car.occupied,collider:h.sim.playerCollider.isEnabled(),position:{...h.sim.player.position}};
 });
 console.log(JSON.stringify(exit));
 expect(exit.phases).toEqual(['getOut','closeOutside','none']);expect(exit.doorOpened).toBe(1);expect(exit.door).toBe(0);expect(exit.occupied).toBe(false);expect(exit.collider).toBe(true);expect(exit.position.x).toBeLessThan(-1);
 await page.locator('#entry-preview').screenshot({path:'artifacts/car-exit-close.png'});
 const poses=await page.evaluate(()=>{
  const h=(window as any).__entry;h.reset(-4,1);h.entry.enter(h.car);const shots:Record<string,number>={};
  for(let i=0;i<60*12&&!h.entry.seated;i++){h.step();if(h.entry.phase==='open'&&Math.abs(h.entry.time-.7)<.009){h.render([-4.5,1.8,-3],[-1,.8,0]);shots.open=h.car.doors[2].ratio;break;}}
  return shots;
 });
 expect(poses.open).toBeGreaterThan(.5);await page.locator('#entry-preview').screenshot({path:'artifacts/car-entry-open.png'});
 await page.evaluate(()=>(window as any).__entry.dispose());expect(errors).toEqual([]);
});
test('holding accelerate while getting in leaves the door swinging, jumping out abandons a moving car',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 await page.evaluate(`(${harness.toString()})().then(h=>{window.__entry=h;})`);await page.waitForFunction(()=>!!(window as any).__entry,undefined,{timeout:120000});
 const result=await page.evaluate(()=>{
  const h=(window as any).__entry;h.reset(-4,1);h.entry.enter(h.car);
  for(let i=0;i<60*12&&!h.entry.seated;i++)h.step({pedal:h.entry.phase==='getIn'});
  const left={phase:h.entry.phase,status:h.car.damageState.doors[2],ratio:h.car.doors[2].ratio};
  let minRatio=left.ratio,swung=false;
  for(let i=0;i<60*6;i++){h.step({pedal:true});minRatio=Math.min(minRatio,h.car.doors[2].ratio);if(Math.abs(h.car.doors[2].ratio-left.ratio)>.05)swung=true;}
  const speed=h.car.speed2D()*50;
  const jumped=h.entry.exit();const phases:string[]=[];
  for(let i=0;i<60*4&&h.entry.active;i++){h.step({pedal:false});const phase=h.entry.phase??'none';if(phases.at(-1)!==phase)phases.push(phase);}
  return {left,swung,minRatio,speed,jumped,phases,driverless:h.car.driverless,occupied:h.car.occupied,carSpeed:h.car.speed2D()*50,player:{...h.sim.player.position},carPosition:{...h.car.car.body.translation()}};
 });
 console.log(JSON.stringify(result));
 expect(result.left.phase).toBe('seated');expect(result.left.status).toBe(1);expect(result.left.ratio).toBeGreaterThan(.5);expect(result.swung).toBe(true);
 expect(result.speed).toBeGreaterThan(15.8);
 expect(result.phases[0]).toBe('jumpOut');expect(result.phases).toContain('getUp');expect(result.driverless).toBe(true);expect(result.occupied).toBe(false);
 await page.evaluate(()=>(window as any).__entry.dispose());expect(errors).toEqual([]);
});
test('entering an NPC-driven car drags the driver out with CAR_pullout and CAR_jacked, or evicts him through the driver door',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 await page.evaluate(`(${harness.toString()})().then(h=>{window.__entry=h;})`);await page.waitForFunction(()=>!!(window as any).__entry,undefined,{timeout:120000});
 const result=await page.evaluate(()=>{
  const h=(window as any).__entry,run=(x:number)=>{
   h.car.driverOut=false;h.car.autopilot={throttle:0,brake:0,steering:0,handbrake:true};h.reset(x,1);h.entry.enter(h.car);const out:{position:any;heading:number}[]=[];h.entry.onDriverOut=(_car:any,position:any,heading:number)=>out.push({position,heading});
   const phases:string[]=[];let npc:any=null;for(let i=0;i<60*14&&!h.entry.seated;i++){h.step();const phase=h.entry.phase;if(phases.at(-1)!==phase)phases.push(phase);npc??=h.entry.npcPose()?.clip??null;}
   const state={phases,npc,out,driverOut:h.car.driverOut,autopilot:h.car.autopilot??null,occupied:h.car.occupied};
   for(let i=0;i<30;i++)h.step();h.entry.exit();for(let i=0;i<60*4&&h.entry.active;i++)h.step();return state;
  };
  return {left:run(-4),right:run(4)};
 });
 console.log(JSON.stringify(result));
 expect(result.left.phases).toEqual(['approach','align','open','pullout','getIn','closeInside','seated']);expect(result.left.npc).toBe('car_jackedlhs');expect(result.left.out).toHaveLength(1);
 expect(result.left.out[0].position.x).toBeLessThan(-3);expect(result.left.driverOut).toBe(true);expect(result.left.autopilot).toBeNull();expect(result.left.occupied).toBe(true);
 expect(result.right.phases).toEqual(['approach','align','open','getIn','closeInside','shuffle','seated']);expect(result.right.npc).toBe('car_getout_lhs');expect(result.right.out).toHaveLength(1);expect(result.right.out[0].position.x).toBeLessThan(-1);
 await page.evaluate(()=>(window as any).__entry.dispose());expect(errors).toEqual([]);
});
