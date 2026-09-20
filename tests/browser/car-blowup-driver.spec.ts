import {test,expect} from '@playwright/test';

test('a traffic car that blows up with its driver aboard leaves him dead at the seat',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{WorldTraffic},{WorldFleet},{WorldPedestrians},{WantedSystem},{Simulation},{loadWorldRoadMaterials},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldTraffic.ts','/src/simulation/WorldFleet.ts','/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/src/assets/worldRoadMaterials.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(700,.5,700).setTranslation(2490,12,1680));sim.respawn={x:2495,y:12.55,z:1687};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const fleet=new WorldFleet(sim,scene,await loadWorldRoadMaterials(base),undefined,base),traffic=new WorldTraffic(sim,fleet,base) as any;
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined,new WantedSystem()) as any;
  crowd.pedTargets=()=>({dealers:0,gangs:0,cops:0,other:0,gangStrengths:Array(10).fill(0)});
  try{
   for(let i=0;i<300&&(!traffic.snapshot().cars.length||!crowd.snapshot().ready);i++){traffic.update(i*2100);crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const car=[...fleet.cars][0] as any;
   const tick=()=>{crowd.update(performance.now());const at=car.car.body.translation();sim.player.position={x:at.x+10,y:at.y,z:at.z+10};traffic.beforeStep(1/60);crowd.beforeStep(1/60,[...fleet.cars]);for(const c of fleet.cars)c.beforeStep(1/60,{x:0,y:0},false);sim.world.step();for(const c of fleet.cars)c.afterStep(1/60);crowd.afterStep();};
   for(let i=0;i<60;i++){tick();if(i%10===0)await new Promise(r=>setTimeout(r,60));}
   let died=0,spawned:any=null;traffic.onDriverDied=(c:any)=>{died++;const seat=c.seat('left'),w=seat?c.worldPoint(seat):c.car.body.translation();spawned=crowd.spawnDead(0,{x:w.x,y:w.y,z:w.z},c.heading(),undefined);};
   const before=crowd.people.length,at={...car.car.body.translation()};
   car.blowUp();
   for(let i=0;i<40;i++){tick();await new Promise(r=>setTimeout(r,25));}
   const body=crowd.people.find((p:any)=>p.health<=0);
   const dist=body?Math.hypot(body.actor.player.position.x-at.x,body.actor.player.position.z-at.z):null;
   // An already wrecked car reports nothing more; a car without a driver aboard reports nothing.
   car.blowUp();
   return {died,spawned,areas:crowd.catalog?.areas?.size??null,before,after:crowd.people.length,dead:!!body,dist,reaction:body?.view.reactionName??null,wrecked:car.wrecked};
  }finally{crowd.dispose();traffic.dispose();fleet.dispose();sim.dispose();}
 });
 expect(result.wrecked).toBe(true);expect(result.died).toBe(1);
 expect(result.after).toBe(result.before+1);expect(result.dead).toBe(true);
 expect(result.dist!).toBeLessThan(2.5);expect(result.reaction).toMatch(/ko_|die|dead/i);
});
