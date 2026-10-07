import {test,expect} from '@playwright/test';

async function shootout(page:import('@playwright/test').Page,hate:boolean,lateDraw=false,bounty=false){
 await page.goto('/models.html');return page.evaluate(async({hate,lateDraw,bounty})=>{
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
  crowd.setPedTypeRelationship(hate?4:3,7,0,true);
  // `lateDraw`: the group's draws miss for the first 4 s and hit after, so only a scanner that looks again (every 3 s
  // after an event, as iOS's does) sees an attack.
  let elapsed=0;crowd.turfRandom=()=>lateDraw&&elapsed<4?.9:0;
  let shots=0;crowd.onShot=()=>{shots++;};
  try{
   // An escalated party's gun: a pistol, or the gang's Uzi.
   for(let i=0;i<300&&!crowd.snapshot().people.some((p:any)=>p.weapon!==undefined);i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const armed=crowd.snapshot().people.find((p:any)=>p.weapon!==undefined);
   if(!armed)throw new Error(JSON.stringify(crowd.snapshot()));
   // CCheat::EverybodyAttacksPlayerCheat turned on: every ped hates him and takes a kill task on him.
   if(bounty){(await import('/src/simulation/nativeCheats.ts' as string)).CHEATS.enable('bounty');crowd.everybodyAttacksPlayer();}
   // Eight metres south of the shooter, in the open, to start with.
   sim.player.position={x:armed.position.x,y:armed.position.y,z:armed.position.z+8};sim.playerBody.setTranslation({...sim.player.position,y:armed.position.y+.9},true);sim.world.step();
   const tick=()=>{crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();elapsed+=1/60;};
   // Rounds go astray by the shooter's inaccuracy, so the first hit can take a few bursts; ten seconds is ample.
   // CPedAcquaintanceScanner sees only what is in front of a ped at its scans (every 500 ms), so he keeps eight metres
   // in front of the armed member until it turns on him. The late draw waits on a scan that sees him again: it gets
   // 15 s and ends at the first shot.
   const shooter=crowd.people.find((p:any)=>p.id===armed.id);
   const inFront=()=>{if(shooter.retaliate>0)return;const q=shooter.actor.player.position,h=shooter.actor.player.heading;sim.player.position={x:q.x+8*Math.sin(h),y:q.y,z:q.z+8*Math.cos(h)};sim.playerBody.setTranslation({...sim.player.position,y:q.y+.9},true);};
   if(lateDraw)for(let i=0;i<900&&shots===0;i++){if(i%15===0)inFront();tick();}
   else for(let i=0;i<(hate||bounty?600:60)&&(i<60||sim.player.health>=100);i++){if(i%15===0)inFront();tick();}
   const health=sim.player.health;
   const snap=crowd.snapshot();const resident=snap.gangs[0];const worn=[...new Set(snap.people.filter((p:any)=>p.gang===0).map((p:any)=>p.model))];
   return {armed:armed.id,shots,health,resident,worn};
  }finally{crowd.dispose();sim.dispose();if(bounty)(await import('/src/simulation/nativeCheats.ts' as string)).CHEATS.disable('bounty');}
 },{hate,lateDraw,bounty});
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

test('a hated mark who stays in view is looked at again every 3 s until the gang attacks',async({page})=>{
 test.setTimeout(180000);const result=await shootout(page,true,true);
 expect(result.shots).toBeGreaterThan(0);
});

test('while the player is wanted every Families member hates cops, and stops once he is not',async({page})=>{
 test.setTimeout(180000);
 await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const law=new WantedSystem(),crowd=new WorldPedestrians(sim,scene,base,()=>undefined,law);
  // Families turf (gangsNeeded is a mask of the gangs: bit 1 for the Families).
  crowd.gangTurf=()=>({gang:1,strength:255});crowd.gangsNeeded=()=>2;
  try{
   for(let i=0;i<300&&!crowd.people.some((p:any)=>p.gang===1);i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const homie=crowd.people.find((p:any)=>p.gang===1);if(!homie)throw new Error('No Families member');
   const regard=()=>crowd.acquaintanceOf(homie).idFor(6)??null;
   const tick=()=>{crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();};
   const before=regard();
   law.setLevelNoDrop(1);for(let i=0;i<40;i++)tick();const wanted=regard();
   law.clear();for(let i=0;i<40;i++)tick();const cleared=regard();
   return {before,wanted,cleared};
  }finally{crowd.dispose();sim.dispose();}
 });
 // ped.dat gives GANG2 no relationship with COP; the pass makes it HATE (4) within 32 frames and takes it away.
 expect(result).toEqual({before:null,wanted:4,cleared:null});
});

test('with a bounty on his head even a gang that only dislikes the player sets on him',async({page})=>{
 test.setTimeout(180000);const result=await shootout(page,false,false,true);
 expect(result.shots).toBeGreaterThan(0);
});
