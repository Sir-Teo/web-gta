import {test,expect} from '@playwright/test';

test('barging into a loitering dealer shoves them aside without damage',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene();
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const crowd=new WorldPedestrians(sim,scene,new URL('/play/world/',location.href).href,()=>undefined);
  // Dealer turf everywhere: every spawn loiters, so only a shove can move them.
  crowd.dealerTurf=()=>255;
  try{
   for(let i=0;i<300&&!crowd.snapshot().people.some((p:any)=>p.loiter);i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const tick=(controls:any)=>{crowd.beforeStep(1/60,[]);sim.step(1/60,controls);sim.world.step();crowd.afterStep();};
   for(let i=0;i<30;i++)tick({x:0,y:0,sprint:false,jump:false,cameraYaw:0});
   const found=crowd.snapshot().people.find((p:any)=>p.loiter);
   if(!found)throw new Error('No loitering dealer');
   const mark={...found.position};
   const still={...crowd.snapshot().people.find((p:any)=>p.id===found.id).position};
   for(let i=0;i<30;i++)tick({x:0,y:0,sprint:false,jump:false,cameraYaw:0});
   const drifted=crowd.snapshot().people.find((p:any)=>p.id===found.id).position;
   const drift=Math.hypot(drifted.x-still.x,drifted.z-still.z);
   // Sprint straight at the dealer from just over a metre out.
   const fx=Math.sin(0.6),fz=Math.cos(0.6);
   sim.player.position={x:mark.x-fx*1.2,y:mark.y,z:mark.z-fz*1.2};
   sim.playerBody.setTranslation({x:mark.x-fx*1.2,y:mark.y+.9,z:mark.z-fz*1.2},true);
   sim.playerBody.setNextKinematicTranslation({x:mark.x-fx*1.2,y:mark.y+.9,z:mark.z-fz*1.2});
   sim.world.step();
   for(let i=0;i<40;i++)tick({x:0,y:-1,sprint:true,jump:false,cameraYaw:0.6});
   const end=crowd.snapshot().people.find((p:any)=>p.id===found.id);
   const along=(end.position.x-still.x)*fx+(end.position.z-still.z)*fz;
   return {drift,along,pedHealth:end.health,playerHealth:sim.player.health};
  }finally{crowd.dispose();sim.dispose();}
 });
 // The dealer holds post on their own (control), then rides the shove line.
 expect(result.drift).toBeLessThan(0.05);
 expect(result.along).toBeGreaterThan(0.15);
 expect(result.pedHealth).toBe(100);
 expect(result.playerHealth).toBe(100);
});
