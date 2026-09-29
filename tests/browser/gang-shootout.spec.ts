import {test,expect} from '@playwright/test';

async function shootout(page:import('@playwright/test').Page,hate:boolean){
 await page.goto('/models.html');return page.evaluate(async(hate:boolean)=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  // Zero-star law loads the weapon assets without adding foot officers.
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined,new WantedSystem());
  // Ballas turf everywhere with an armed mark: parties escalate to pistols.
  crowd.gangTurf=()=>({gang:0,strength:255});crowd.gangsNeeded=()=>1;crowd.playerArmed=()=>true;
  // The Ballas hate the player (SWEET4's SET_RELATIONSHIP), and their group's draw answers his sighting with an attack.
  // MAIN.SCM's start leaves the Ballas disliking him (3); SWEET4's pass makes it hate (4).
  crowd.setPedTypeRelationship(hate?4:3,7,0,true);crowd.turfRandom=()=>0;
  let shots=0;crowd.onShot=()=>{shots++;};
  try{
   for(let i=0;i<300&&!crowd.snapshot().people.some((p:any)=>p.weapon===22);i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const armed=crowd.snapshot().people.find((p:any)=>p.weapon===22);
   if(!armed)throw new Error(JSON.stringify(crowd.snapshot()));
   // Stand eight metres south of the shooter, in the open.
   sim.player.position={x:armed.position.x,y:armed.position.y,z:armed.position.z+8};sim.playerBody.setTranslation({...sim.player.position,y:armed.position.y+.9},true);sim.world.step();
   const tick=()=>{crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();};
   // Rounds go astray by the shooter's inaccuracy, so the first hit can take a few bursts; ten seconds is ample.
   for(let i=0;i<(hate?600:60)&&(i<60||sim.player.health>=100);i++)tick();
   const health=sim.player.health;
   const snap=crowd.snapshot();const resident=snap.gangs[0];const worn=[...new Set(snap.people.filter((p:any)=>p.gang===0).map((p:any)=>p.model))];
   return {armed:armed.id,shots,health,resident,worn};
  }finally{crowd.dispose();sim.dispose();}
 },hate);
}

test('armed turf gangs stand and shoot an armed mark they hate',async({page})=>{
 test.setTimeout(180000);const result=await shootout(page,true);
 expect(result.shots).toBeGreaterThan(0);
 expect(result.health).toBeLessThan(100);
 // CStreaming keeps two of the gang's three models resident and every member wears one of them.
 expect(result.resident.length).toBe(2);
 for(const model of result.worn)expect(result.resident).toContain(model);
});

test('a gang that only dislikes the player leaves an armed mark be',async({page})=>{
 test.setTimeout(180000);const result=await shootout(page,false);
 expect(result.shots).toBe(0);expect(result.health).toBe(100);
});
