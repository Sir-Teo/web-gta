import {test,expect} from '@playwright/test';

test('Grove crew recruitment follows, fights and disbands',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  // Zero-star law loads officer assets without patrolling foot cops.
  const law=new WantedSystem();
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined,law);
  // Families turf: recruitable homies wander nearby.
  crowd.gangTurf=()=>({gang:1,strength:255});
  const out:Record<string,unknown>={};
  try{
   for(let i=0;i<300&&!crowd.snapshot().people.some((p:any)=>p.gang===1);i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const tick=()=>{crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();};
   for(let i=0;i<30;i++)tick();
   const mark=crowd.snapshot().people.find((p:any)=>p.gang===1);
   if(!mark)throw new Error('No Families member');
   sim.player.position={x:mark.position.x+2,y:mark.position.y,z:mark.position.z};sim.player.heading=0;
   sim.playerBody.setTranslation({x:mark.position.x+2,y:mark.position.y+.9,z:mark.position.z},true);
   sim.playerBody.setNextKinematicTranslation({x:mark.position.x+2,y:mark.position.y+.9,z:mark.position.z});
   sim.world.step();
   out.joined=crowd.recruit();
   const homie=()=>crowd.snapshot().people.find((p:any)=>p.follow);
   if(!homie())throw new Error('Nobody joined');
   // March north: the crew shadows the mark.
   const from={...homie()!.position};
   sim.player.position={x:from.x,y:from.y,z:from.z-25};
   sim.playerBody.setTranslation({x:from.x,y:from.y+.9,z:from.z-25},true);
   sim.playerBody.setNextKinematicTranslation({x:from.x,y:from.y+.9,z:from.z-25});
   sim.world.step();
   for(let i=0;i<300;i++)tick();
   const kept=crowd.snapshot().people.find((p:any)=>p.follow);
   out.followed=kept?Math.hypot(kept.position.x-sim.player.position.x,kept.position.z-sim.player.position.z):null;
   // A one-star officer wades in with the nightstick: the crew answers it.
   law.setLevel(1);
   for(let i=0;i<300&&!crowd.snapshot().people.some((p:any)=>p.officer);i++){crowd.update(200000+i*1600);await new Promise(r=>setTimeout(r,10));}
   let bloodied=false;
   for(let i=0;i<1500&&!bloodied;i++){if(i%60===0)sim.player.health=100;tick();bloodied=crowd.snapshot().people.some((p:any)=>p.officer&&p.health<100);}
   out.brawl=bloodied;
   out.dismissed=crowd.recruit();
   out.crewLeft=crowd.snapshot().people.filter((p:any)=>p.follow).length;
   return out;
  }finally{crowd.dispose();sim.dispose();}
 });
 expect(result.joined).toBe('joined');
 expect(result.followed).toBeLessThan(12);
 expect(result.brawl).toBe(true);
 expect(result.dismissed).toBe('dismissed');
 expect(result.crewLeft).toBe(0);
});
