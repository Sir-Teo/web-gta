import {test,expect} from '@playwright/test';

test('armed turf gangs stand and shoot an armed mark',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  // Zero-star law loads the weapon assets without adding foot officers.
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined,new WantedSystem());
  // Ballas turf everywhere with an armed mark: parties escalate to pistols.
  crowd.gangTurf=()=>({gang:0,strength:255});crowd.gangsNeeded=()=>1;crowd.playerArmed=()=>true;
  let shots=0;crowd.onShot=()=>{shots++;};
  try{
   for(let i=0;i<300&&!crowd.snapshot().people.some((p:any)=>p.weapon===22);i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const armed=crowd.snapshot().people.find((p:any)=>p.weapon===22);
   if(!armed)throw new Error(JSON.stringify(crowd.snapshot()));
   // Stand eight metres south of the shooter, in the open.
   sim.player.position={x:armed.position.x,y:armed.position.y,z:armed.position.z+8};sim.playerBody.setTranslation({...sim.player.position,y:armed.position.y+.9},true);sim.world.step();
   const tick=()=>{crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();};
   for(let i=0;i<60;i++)tick();
   const health=sim.player.health;
   const snap=crowd.snapshot();const resident=snap.gangs[0];const worn=[...new Set(snap.people.filter((p:any)=>p.gang===0).map((p:any)=>p.model))];
   return {armed:armed.id,shots,health,resident,worn};
  }finally{crowd.dispose();sim.dispose();}
 });
 expect(result.shots).toBeGreaterThan(0);
 expect(result.health).toBeLessThan(100);
 // CStreaming keeps two of the gang's three models resident and every member wears one of them.
 expect(result.resident.length).toBe(2);
 for(const model of result.worn)expect(result.resident).toContain(model);
});
