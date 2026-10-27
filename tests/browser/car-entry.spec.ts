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
test('a jump-out takes the passenger door when a wall blocks the driver\'s, and waits when both are blocked',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 await page.evaluate(`(${harness.toString()})().then(h=>{window.__entry=h;})`);await page.waitForFunction(()=>!!(window as any).__entry,undefined,{timeout:120000});
 const result=await page.evaluate(async()=>{
  const dependencies='/tests/fixtures/native-render-dependencies.ts',{RAPIER}=await import(/* @vite-ignore */ dependencies);
  const h=(window as any).__entry;h.reset(-4,1);h.entry.enter(h.car);
  for(let i=0;i<60*12&&!h.entry.seated;i++)h.step();
  for(let i=0;i<60*6;i++)h.step({pedal:true});
  // IsRoomForPedToLeaveCar: a block standing where the ped would come out of each door.
  const wall=(side:'left'|'right')=>{const w=h.car.worldPoint(h.entry.doorPoint(h.car,side,1));return h.sim.world.createCollider(RAPIER.ColliderDesc.ball(1).setSensor(true).setTranslation(w.x,w.y+.5,w.z));};
  // A world step brings the new colliders into the scene queries (the car moves on half a metre meanwhile).
  const left=wall('left'),right=wall('right');h.sim.world.step();
  const speed=h.car.speed2D()*50;h.entry.exit();const both=h.entry.phase;
  h.sim.world.removeCollider(right,false);h.sim.world.step();h.entry.backToSeat(h.car);
  h.entry.exit();const one={phase:h.entry.phase,side:h.entry.side};
  h.sim.world.removeCollider(left,false);
  for(let i=0;i<60*4&&h.entry.active;i++)h.step({pedal:false});
  return {speed,both,one};
 });
 console.log(JSON.stringify(result));
 expect(result.speed).toBeGreaterThan(15.8);
 expect(result.both).toBe('waitSlow');
 expect(result.one).toEqual({phase:'jumpOut',side:'right'});
 await page.evaluate(()=>(window as any).__entry.dispose());expect(errors).toEqual([]);
});
test('a recruit riding with CJ rolls out with the car\'s speed when he jumps out',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 await page.evaluate(`(${harness.toString()})().then(h=>{window.__entry=h;})`);await page.waitForFunction(()=>!!(window as any).__entry,undefined,{timeout:120000});
 const result=await page.evaluate(()=>{
  const h=(window as any).__entry,spawned:any[]=[];
  h.entry.crowd={followers:()=>[],boardPassenger:()=>undefined,spawnPassenger:(_m:unknown,_p:unknown,_h:unknown,_f:unknown,_k:unknown,rollout:any)=>{spawned.push(rollout??null);return true;}};
  const ride=(fast:boolean)=>{
   h.reset(-4,1);h.entry.enter(h.car);
   for(let i=0;i<60*12&&!h.entry.seated;i++){h.step();h.entry.stepPassengers(1/60);}
   h.entry.passengers.push({modelRef:0,seat:1,follow:true});
   for(let i=0;i<60*(fast?6:0);i++){h.step({pedal:true});h.entry.stepPassengers(1/60);}
   for(let i=0;i<60*(fast?0:3);i++){h.step({handbrake:true});h.entry.stepPassengers(1/60);}
   h.entry.exit();
   for(let i=0;i<60*4&&(h.entry.active||spawned.length<(fast?1:2));i++){h.step();h.entry.stepPassengers(1/60);}
  };
  ride(true);
  return spawned.map(r=>r&&{clip:r.clip,speed:Math.hypot(r.velocity.x,r.velocity.z)});
 });
 console.log(JSON.stringify(result));
 // GroupEventHandler: the follower leaves without waiting (bSensibleLeaveCar off), rolling out of the right front seat.
 expect(result[0]?.clip).toBe('car_rollout_rhs');expect(result[0]?.speed).toBeGreaterThan(8);
 await page.evaluate(()=>(window as any).__entry.dispose());expect(errors).toEqual([]);
});
test('entering an NPC-driven car drags the driver out with CAR_pullout and CAR_jacked, or evicts him through the driver door',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 await page.evaluate(`(${harness.toString()})().then(h=>{window.__entry=h;})`);await page.waitForFunction(()=>!!(window as any).__entry,undefined,{timeout:120000});
 const result=await page.evaluate(()=>{
  const h=(window as any).__entry,run=(x:number)=>{
   h.car.driverOut=false;h.car.autopilot={throttle:0,brake:0,steering:0,handbrake:true};h.reset(x,1);h.entry.enter(h.car);const out:{position:any;heading:number}[]=[];h.entry.onDriverOut=(_car:any,position:any,heading:number)=>out.push({position,heading});
   const phases:string[]=[];let npc:any=null,seated:number|null=null;for(let i=0;i<60*14&&!h.entry.seated;i++){h.step();const phase=h.entry.phase;if(phases.at(-1)!==phase)phases.push(phase);
    const pose=h.entry.npcPose();
    // The jacked driver's first frame: how far across the car his pelvis (the door point plus the clip's first root key) is from his seat.
    if(pose&&npc===null&&pose.clip==='car_jackedlhs'){const root=h.entry.npcClip.clip.tracks.find((t:any)=>t.boneId===0&&t.translations);seated=Math.abs(pose.local.x+root.translations[0]-h.car.seat('left').x);}
    npc??=pose?.clip??null;}
   const state={phases,npc,out,seated,driverOut:h.car.driverOut,autopilot:h.car.autopilot??null,occupied:h.car.occupied};
   for(let i=0;i<30;i++)h.step();h.entry.exit();for(let i=0;i<60*4&&h.entry.active;i++)h.step();return state;
  };
  return {left:run(-4),right:run(4)};
 });
 console.log(JSON.stringify(result));
 expect(result.left.phases).toEqual(['approach','align','open','pullout','getIn','closeInside','seated']);expect(result.left.npc).toBe('car_jackedlhs');expect(result.left.out).toHaveLength(1);
 // He starts in his seat, not a metre out by the open door (an authored door-ajar clearance once did that).
 expect(result.left.seated).toBeLessThan(.05);
 expect(result.left.out[0].position.x).toBeLessThan(-3);expect(result.left.driverOut).toBe(true);expect(result.left.autopilot).toBeNull();expect(result.left.occupied).toBe(true);
 expect(result.right.phases).toEqual(['approach','align','open','getIn','closeInside','shuffle','seated']);expect(result.right.npc).toBe('car_getout_lhs');expect(result.right.out).toHaveLength(1);expect(result.right.out[0].position.x).toBeLessThan(-1);
 await page.evaluate(()=>(window as any).__entry.dispose());expect(errors).toEqual([]);
});
test('the driver\'s steering clip plays from its first frame and the reverse look-back cross-fades with it',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 await page.evaluate(`(${harness.toString()})().then(h=>{window.__entry=h;})`);await page.waitForFunction(()=>!!(window as any).__entry,undefined,{timeout:120000});
 const run=await page.evaluate(()=>{
  const h=(window as any).__entry;h.entry.warpIn(h.car);
  for(let i=0;i<30;i++)h.step();
  const steer:any[]=[];for(let i=0;i<12;i++){h.step({axes:{x:-1,y:0}});steer.push(h.entry.pose().partials.map((o:any)=>({...o})));}
  h.render([-4,2,-4],[0,.8,0]);
  const back:any[]=[];for(let i=0;i<40;i++){h.step({axes:{x:-1,y:-1}});back.push({gas:h.car.gasPedal,partials:h.entry.pose().partials.map((o:any)=>({...o}))});}
  h.render([-4,2,-4],[0,.8,0]);h.dispose();return {steer,back};
 });
 // One steering clip, starting at its first frame and playing on (it is not frozen at its last).
 const first=run.steer.find((s:any[])=>s.length)!;expect(first.length).toBe(1);expect(first[0].seconds).toBeLessThan(.05);
 expect(run.steer.at(-1)[0].seconds).toBeGreaterThan(first[0].seconds);
 // Reversing: a frame where the steering clip is fading while CAR_LB is fading in, both partly weighted.
 const reversing=run.back.filter((b:any)=>b.gas<0);expect(reversing.length).toBeGreaterThan(0);
 expect(reversing.some((b:any)=>b.partials.length===2&&b.partials.every((o:any)=>o.amount>0&&o.amount<1)),JSON.stringify(reversing.slice(0,6))).toBe(true);
 expect(reversing.at(-1).partials.map((o:any)=>o.clip)).toEqual([expect.stringMatching(/^car_lb/)]);
 expect(errors).toEqual([]);
});
test('a creeping NPC car CJ jacks stops at the door and stays put through the pull-out and his climb in',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 await page.evaluate(`(${harness.toString()})().then(h=>{window.__entry=h;})`);await page.waitForFunction(()=>!!(window as any).__entry,undefined,{timeout:120000});
 const result=await page.evaluate(()=>{
  const h=(window as any).__entry,b=h.car.car.body;
  // The driver creeps on at part throttle.
  h.car.driverOut=false;h.car.autopilot={throttle:.3,brake:0,steering:0,handbrake:false};
  // CJ stands at the driver's door as the car rolls up to him at 5 m/s: he reaches it at once.
  const door=h.car.worldPoint(h.entry.doorPoint(h.car,'left'));h.reset(door.x,door.z);
  const q=b.rotation(),fw={x:-2*(q.x*q.z+q.w*q.y),z:-(1-2*(q.x*q.x+q.y*q.y))};b.setLinvel({x:fw.x*5,y:0,z:fw.z*5},true);
  h.entry.enter(h.car);
  const at:Record<string,{x:number;z:number;speed:number}>={};let last:string|undefined;
  for(let i=0;i<60*14&&!h.entry.seated;i++){h.step();const phase=h.entry.phase;if(phase!==last){const p=b.translation(),v=b.linvel();at[phase]={x:p.x,z:p.z,speed:Math.hypot(v.x,v.z)};last=phase;}}
  const p=b.translation();at.end={x:p.x,z:p.z,speed:Math.hypot(b.linvel().x,b.linvel().z)};
  return {at,seated:!!h.entry.seated};
 });
 const moved=(a:any,b:any)=>Math.hypot(b.x-a.x,b.z-a.z);
 expect(result.seated).toBe(true);
 expect(Object.keys(result.at)).toContain('pullout');
 // From the door on the car stands: under half a unit from the align to CJ seated, at rest by the pull-out.
 expect(moved(result.at.align,result.at.end)).toBeLessThan(.5);
 expect(result.at.pullout.speed).toBeLessThan(.5);
 await page.evaluate(()=>(window as any).__entry.dispose());expect(errors).toEqual([]);
});
