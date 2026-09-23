import {test,expect} from '@playwright/test';

test('a BMX pedals, steers with lean, poses the rider and knocks off on impact',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldBike},{WorldBike},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldBike.ts','/src/simulation/WorldBike.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href;
  const catalog=await openStaticWorldVehicles(await openStaticWorld(base));
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
   // A wall stop at speed knocks the rider off through the force formula.
   sim.world.createCollider(RAPIER.ColliderDesc.cuboid(5,3,.5).setTranslation(0,3,-40));
   bike.body.setTranslation({x:0,y:1.5,z:-20},true);bike.body.setRotation({x:0,y:0,z:0,w:1},true);bike.body.setLinvel({x:0,y:0,z:-30},true);
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
 expect(result.speed).toBeGreaterThan(2);
 expect(result.idle).toBe('bmx_pedal');
 expect(result.seat).toBe(true);
 expect(result.block).toBe('bmx');
 expect(result.headingBefore).toBeDefined();
 expect(Math.abs((result.heading as number)-(result.headingBefore as number))).toBeGreaterThan(.05);
 expect(result.lean).toBeGreaterThan(.02);
 expect(result.overlay).toMatchObject({clip:'bmx_right'});
 expect(result.knocked).toBe(true);
 expect(result.knockMessage).toBe('Knocked off the bike!');
 expect(errors).toEqual([]);
});
